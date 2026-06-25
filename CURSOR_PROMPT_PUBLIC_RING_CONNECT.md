# Task: Public Ring doorbell owner connect flow (decoupled from agency staff auth)

Drop this file in the repo root. Open it in Cursor alongside:
- `apps/api/src/integrations/ring/` (OAuth, callback, token store)
- `apps/marketing/app/(marketing)/connect/ring/link/` (public post-OAuth landing)
- `apps/web` sign-in page (footer links)
- `infra/nested/stack-app-sam.yaml` (`SalesLeadsTable`)
- `scripts/onboard-pilot-customer.ts` (pilot onboarding)
- `docs/product-architecture/RING_CONNECT_CAMERA_ACCESS.md` (staff-side reference)

---

## Context

Rapid Cortex monorepo (`apps/web` = Next.js frontend, `apps/api` = Lambda/API Gateway,
`packages/shared` = roles/RBAC). Ring integration already exists for the **agency** side:

- OAuth linking today happens via `/api/integrations/ring/oauth/start` and
  `/api/integrations/ring/callback`, reached from inside the authenticated app
  (Media → Ring tab → Connect Ring Account).
- Tokens are stored per `agencyId` + `userId` in DynamoDB `rc-camera-provider-tokens`.
- Per-incident consent (the SMS/email approve-decline link sent to a doorbell owner
  when a dispatcher requests footage) is already public/token-gated — no login
  required at that step. Use this as the reference pattern for "public but safe."
- A public post-OAuth landing page already exists at
  `https://www.rapidcortex.us/connect/ring/link/` (built for Ring's Amazon
  certification review).
- The staff sign-in page (`apps/web`, Cognito-backed) currently has footer links:
  "Need an account? Contact your admin · Plans · Home".
- A `SalesLeadsTable` already exists in `infra/nested/stack-app-sam.yaml` — reuse it
  for the waitlist capture in this task rather than creating a new table.
- `scripts/onboard-pilot-customer.ts` is the existing onboarding entry point —
  this is where the public-directory opt-in flag should get set per agency.

## Problem

A Ring doorbell owner is a member of the public, not agency staff. There is
currently no way for them to link their own Ring account without going through
the staff Cognito sign-in screen, which assumes an agency role
(dispatcher/supervisor/admin/etc). We need a fully public, no-Cognito-login path
to (a) find the right agency and (b) link a Ring account to it — plus a related
SMS consent host-mismatch fix (Requirement C).

## Step 0 — Explore before changing anything

Report back on these before writing code:

1. Auth middleware on `/api/integrations/ring/oauth/start` and `/callback` — does it
   require a valid Cognito JWT today? What claims does it read (`agencyId`, `userId`)?
2. Schema of `rc-camera-provider-tokens` — partition key / sort key / attributes.
3. Current schema of `AgenciesTable` — confirm whether any public-facing
   name/city/state fields already exist, or whether all fields are internal-only.
4. Schema of `SalesLeadsTable` and any existing lead-capture endpoint/handler —
   confirm field names so the new waitlist write matches existing conventions
   instead of inventing a parallel shape.
5. The sign-in page component (the one in the screenshot) — exact file path.
6. Implementation of `/connect/ring/link/` on the marketing site.
7. Resolve the www vs. app host mismatch for SMS consent: the marketing deploy
   log confirms `/sms-consent/index.html` is built and live at
   `https://www.rapidcortex.us/sms-consent` with no auth (it ships from
   `apps/marketing/out/` to the public static bucket — same pipeline as
   `/connect/ring/link/`, `/privacy/`, `/terms/`, `/cookies/`, `/acceptable-use/`).
   Check whether `https://app.rapidcortex.us/sms-consent` resolves to anything at
   all in the SSR app. If it's a stale/unintentional route, the bug isn't
   "gated behind auth" — it's a wrong-host reference. Confirm before assuming
   an auth-middleware fix is needed.

## Requirements

### A.1 Backend — citizen identity, explicitly NOT a Cognito user

- New record type for a linked Ring device owner: keyed by something stable but
  not tied to the agency Cognito pool — e.g. `PK: RINGOWNER#<ringAccountId>`,
  storing name/phone/email (optional, for consent notifications), linked
  `deviceIds`, and the `agencyId` they've opted to share with.
- This identity must never be added to any Cognito group and must never be
  issuable a JWT with a role claim. Add an explicit test (model it on
  `cross-agency-isolation-test.ts`) asserting a RINGOWNER record cannot
  authenticate against any `/api/*` route that expects an agency JWT.
- New public endpoint(s), unauthenticated, rate-limited by IP
  (reuse whatever rate-limit utility the existing 5/hour camera-request logic
  uses):
  - `GET /api/public/ring/oauth/start?agencyId=<id>` — begins Ring OAuth for a
    citizen, passing `agencyId` through OAuth `state` so the callback knows which
    agency they're opting into.
  - The existing `/api/integrations/ring/callback` either branches on whether the
    incoming state was a citizen-initiated request, or gets a sibling public
    callback — your call after Step 0, pick whichever fits the existing callback
    code with the least duplication.
  - On success, store the token + RINGOWNER record, then redirect to
    `/connect/ring/link/?status=success` (existing page, existing pattern).

### A.2 Backend — agency directory (opt-in only) + waitlist fallback

A citizen needs to find their own agency before OAuth starts. This must NOT be a
full public customer roster — many agencies (pilots especially) are confidential
and have not consented to being named publicly. Visibility is opt-in per agency.

- Add to `AgenciesTable`:

  ```typescript
  publicDirectoryOptIn: boolean   // default false
  publicDisplayName: string      // may differ from internal/legal name
  publicCity: string
  publicState: string            // 2-letter, validated against a closed enum
  ```

- `scripts/onboard-pilot-customer.ts` gets a flag/step to set these — default
  stays `false`; an agency is only listed once it explicitly opts in (this can
  happen well after pilot, at production launch, etc).
- New public, rate-limited, unauthenticated endpoint:

  `GET /api/public/agencies/by-state?state=GA`

  → only agencies where `publicDirectoryOptIn = true` AND `publicState = "GA"`

  → returns `[{ agencySlug, publicDisplayName, publicCity }]`

  → never returns `agencyId`, internal name, or any other field

  Validate `state` against the closed 2-letter state/DC enum server-side — reject
  anything else with a 400, don't pass it through to a query unvalidated.

- New public, rate-limited endpoint for the empty-state fallback:

  `POST /api/public/leads`

  Body: `{ email, requestedState, requestedCity? }`

  → writes to `SalesLeadsTable` using its existing field conventions (confirm in
  Step 0), tagged with `source: "ring-connect-waitlist"`

  → basic email format validation; reject obviously malformed input

- Frontend picker flow (public, on the marketing site or wherever
  `/connect/ring/` lives — confirm in Step 0 where this belongs):
  1. State dropdown (static 50-state + DC list, no API call needed for this step)
  2. On select → call `by-state` → render result cards (`publicDisplayName` +
     `publicCity`) → clicking one kicks off `GET /api/public/ring/oauth/start?agencyId=...`
     using the agencySlug-to-agencyId resolution (resolve slug server-side, never
     pass a real `agencyId` to the client)
  3. Empty result (no opted-in agencies in that state) → show the waitlist email
     form instead → `POST /api/public/leads`

### B. Frontend — sign-in page

- Add a link below the existing "Need an account? Contact your admin · Plans ·
  Home" line, visually separated (its own row, distinct from the staff-account
  copy) — label: **"Ring doorbell owner? Connect your camera"**.
- href goes to the new public agency-picker flow (A.2), not directly to OAuth —
  the citizen needs to pick their agency first unless they arrived via an
  agency-specific link/QR code that already encodes it.
- Must NOT submit through the Cognito sign-in form and must work for a visitor
  with no session at all.
- Reuse existing button/link styling tokens from the sign-in component — no new
  design system.

### C. Bug fix — SMS consent host mismatch (replaces "public-route bug fix")

- `/sms-consent` already exists and is public at `https://www.rapidcortex.us/sms-consent`
  (confirmed via the marketing deploy log — no auth fix needed there).
- If Step 0 finds that `app.rapidcortex.us/sms-consent` does not resolve, or
  resolves into the authenticated SSR app, do NOT add an auth-bypass route on
  `app.*` — that duplicates the page on the wrong domain. Instead, either:
  (a) add a redirect from `app.rapidcortex.us/sms-consent` →
      `https://www.rapidcortex.us/sms-consent`, or
  (b) confirm nothing in the app actually links to the `app.*` path and leave it
      as-is.
- Separately, outside this engineering task: the signed MSA's "Incorporated
  Policies" section currently links SMS Consent to
  `https://app.rapidcortex.us/sms-consent`. That needs correcting to the www.
  host — that's a document fix, not code, flagging here so it isn't lost.

## Acceptance criteria

- A fresh incognito browser (no cookies, no Cognito session) can: click the new
  link on the sign-in page → pick a state → pick their agency from opted-in
  results → complete Ring OAuth → land on `/connect/ring/link/?status=success` —
  without ever seeing a password field or the staff dashboard.
- An agency with `publicDirectoryOptIn: false` (or unset) never appears in any
  `by-state` response, regardless of state match. Add a test asserting this
  explicitly using a pilot-flagged fixture agency.
- A state with zero opted-in agencies returns an empty array (not an error), and
  the frontend falls back to the waitlist form.
- A RINGOWNER record cannot be used to obtain a JWT or hit any agency-scoped
  `/api/*` route. Add/extend an isolation test proving this.
- `by-state`, `leads`, and the public OAuth-start endpoint are all rate-limited
  per IP and fail closed (no partial/duplicate records) on retry.
- `state` query param is rejected with 400 for any value outside the closed
  2-letter enum.
- A submitted waitlist lead appears in `SalesLeadsTable` with
  `source: "ring-connect-waitlist"` and the requested state/city.
- `https://www.rapidcortex.us/sms-consent` loads in an incognito session (canonical
  public URL). Per Requirement C, `app.rapidcortex.us/sms-consent` either redirects
  to www or is confirmed unused — no duplicate SSR page on the app host.
- Existing dispatcher-side Ring flow (Media → Ring tab → Connect Ring Account)
  is unchanged and still works for agency staff testing/demo accounts.

---

Start with **Step 0** and report findings before writing any code — several of the
file paths, existing schemas, and exact auth behavior above are inferred from
`RING_INTEGRATION_REFERENCE.md` and the infra scripts, not confirmed against the
live code.
