# Ring Connect — Step 0 Investigation Findings

Read-only audit completed before implementing public Ring doorbell owner connect (`CURSOR_PROMPT_PUBLIC_RING_CONNECT.md`).  
**No application code was changed** in this pass.

---

## Spec corrections (read these first)

Several assumptions in `CURSOR_PROMPT_PUBLIC_RING_CONNECT.md` do not match the repo:

| Spec assumption | Actual state |
|---|---|
| OAuth start route is `/api/integrations/ring/oauth/start` | **Wrong path.** Production route is **`GET /api/integrations/ring/login`** (`infra/nested/stack-app-sam-4.yaml` L2005–2010, handler `apps/api/src/integrations/ring/login.ts`). |
| Ring OAuth tokens live in `rc-camera-provider-tokens` | **Wrong store.** Ring tokens are stored in **AWS Secrets Manager** (`RingTokenStore` in `packages/integrations/ring/ring-token-store.ts`). Linked-account metadata lives in **`RapidCortexRingAccounts-{stage}`** (`RingAccountsTable`). |
| `rc-camera-provider-tokens` is the Ring token table | That table is used by the **Nest camera provider** OAuth flow (`apps/api/src/integrations/cameras/nest-oauth.ts`), not Ring Connect. |
| `RING_INTEGRATION_REFERENCE.md` exists in-repo | **Not found.** Only referenced from the spec prompt itself. |
| `/connect/ring/link/` handles `?status=pending` | **Not implemented.** Client handles `success`, `connected`, `error`, and a neutral default only. |
| `SalesLeadsTable` has `source` / `status` conventions | **No such fields** in the Zod schema or write path today. |
| `AgenciesTable` has `publicDirectoryOptIn`, `publicDisplayName`, `publicCity`, `publicState` | **None exist** in code or types (grep across `apps/api` is empty). |

---

## 1. OAuth middleware — JWT requirement on Ring OAuth routes

### Direct answer

- **Start (staff) OAuth:** **Yes — requires a valid Cognito identity today**, enforced at **two layers**:
  1. **API Gateway (stack 4):** `GET /api/integrations/ring/login` inherits the HTTP API **`DefaultAuthorizer: CognitoJwtAuthorizer`** (no per-route `Authorizer: NONE` override).
  2. **Lambda handler (inline):** `login.ts` calls `getUserContext(event)` and returns **401** if absent; also checks account active, operational password gate, and `isRingEnabled()`.

- **Callback:** **No Cognito JWT required.** API Gateway sets **`Auth: Authorizer: NONE`** on `GET /api/integrations/ring/callback`. The handler does **not** call `getUserContext`; it validates Ring `code` + `state`, loads OAuth state from DynamoDB, exchanges tokens, and redirects.

- **There is no shared Ring “middleware decorator.”** Auth is API Gateway JWT defaults plus per-handler `getUserContext()` (login) or OAuth state validation (callback).

- **Route path note:** Browsers and UI hit **`/api/integrations/ring/login`**, not `/oauth/start`. Web BFF: `apps/web/app/api/integrations/ring/[[...segments]]/route.ts`.

### Claims read from JWT (`getUserContext` → `mapPayload`)

From `apps/api/src/lib/auth.ts` L52–98, L69–98:

| Claim | Maps to |
|---|---|
| `sub` | `userId` (required) |
| `custom:role` (then `preferred_role`, then `cognito:groups`) | `role` via `resolveRoleFromJwtPayload` + `normalizeRole` |
| `custom:agencyId` | `agencyId` (required; `rcsuperadmin` may fall back to platform ID) |
| `custom:status` | `accountStatus` |
| `email` / `cognito:username` | `email` |
| `custom:planId` / `custom:subscriptionPlanId` | `planId` |
| `custom:hospitalId` | `hospitalId` |
| `custom:firstName` / `custom:lastName` | `displayName` |
| `custom:pwdChangedAt` / `custom:pwdChangeReq` | password rotation fields |

`getUserContext` accepts JWT from **`Authorization: Bearer`** header **or** API Gateway authorizer-injected `requestContext.authorizer.jwt.claims` (L245–278).

### Evidence excerpts

**Handler guard (login / start):** `apps/api/src/integrations/ring/login.ts` L13–25

```typescript
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) {
      return ringJson({ success: false, error: "Unauthorized" }, 401);
    }
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }
    // ...
    const { url, state } = await oauth.buildAuthorizationUrl(user.agencyId, user.userId, ringReturnUrl);
```

**API Gateway — default JWT + callback exception:** `infra/nested/stack-app-sam-4.yaml` L1589–1598, L2043–2050

```yaml
      Auth:
        DefaultAuthorizer: CognitoJwtAuthorizer
        Authorizers:
          CognitoJwtAuthorizer:
            IdentitySource: "$request.header.Authorization"
            JwtConfiguration:
              issuer: !Ref ImportedCognitoIssuer
              audience:
                - !Ref ImportedCognitoWebClientId
                - !Ref ImportedCognitoNativeClientId
# ...
            Path: /api/integrations/ring/callback
            Method: GET
            Auth:
              Authorizer: NONE
```

**Web BFF — login proxies Cognito cookie as Bearer:** `apps/web/app/api/integrations/ring/[[...segments]]/route.ts` L16–35

```typescript
  const isOAuthLogin = path === "/api/integrations/ring/login" && request.method === "GET";
  // ...
  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const upstream = await fetch(target, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
```

**Callback — no JWT, OAuth state only:** `apps/api/src/integrations/ring/callback.ts` L34–76 (no `getUserContext` call).

---

## 2. `rc-camera-provider-tokens` schema

### Direct answer

**Physical table:** `${AppName}-camera-provider-tokens-${DeploymentStage}` (e.g. `rapid-cortex-camera-provider-tokens-dev`).  
**Defined in:** `infra/nested/stack-app-sam-4.yaml` L1938–1951 (managed in stack 4, not `stack-data-layer.yaml`).

| Element | Value |
|---|---|
| Partition key | `pk` (String, HASH) |
| Sort key | **None** |
| GSIs | **None** |
| TTL | **Not configured** on this table |
| Encryption | SSE-KMS enabled |

**DynamoDB only declares `pk`.** All other attributes are application-written (schemaless).

### Attributes written today (Nest provider only)

From `apps/api/src/integrations/cameras/nest-oauth.ts` L147–172 (`storeNestTokens`):

- `pk` — `${agencyId}#nest`
- `agencyId`, `provider` (`"nest"`), `projectId`, `clientId`
- `accessToken`, `refreshToken?`, `expiresAt` (number)
- `createdAt`, `updatedAt` (ISO strings)

**Ring Connect does not read or write this table.** Ring OAuth tokens go to Secrets Manager (`packages/integrations/ring/ring-token-store.ts` L56–92, secret name `${RING_SECRETS_PREFIX}/${agencyId}/${userId}`).

### Evidence excerpt

`infra/nested/stack-app-sam-4.yaml` L1938–1951

```yaml
  CameraProviderTokensTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${AppName}-camera-provider-tokens-${DeploymentStage}"
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
```

---

## 3. `AgenciesTable` schema — public-facing fields

### Direct answer

**Physical table:** `${DynamoTableNamePrefix}-agencies-${DeploymentStage}` in `infra/nested/stack-data-layer.yaml` L1186–1270.

| Element | Value |
|---|---|
| Partition key | `agencyId` (HASH) |
| Sort key | None |
| GSIs | `status-createdAt-index` (PK `status`, SK `createdAt`); `vertical-index` (PK `vertical`, SK `createdAt`) |

**DynamoDB attribute definitions** only include keys for those indexes: `agencyId`, `status`, `vertical`, `createdAt`. The table is schemaless for non-key attributes.

### Canonical application attribute list (`AgencyTenant`)

From `packages/shared/src/tenancy/agency.ts` L51–119 (what handlers/repos expect on the primary item):

`agencyId`, `vertical?`, `addons?`, `planTier?`, `pilotMode?`, `name`, `type`, `status`, **`state`**, **`city?`**, **`centerName?`**, `region`, `primaryContactName`, `primaryContactEmail`, `deploymentMode`, `protocolPackId`, `retentionPolicyId`, `integrationMode`, `createdAt`, `updatedAt`, `createdByUserId`, `config`, plus optional billing/monetization/network fields (`billingStatus`, `subscriptionStatus`, `monetizationPlanId`, `networkPolicy`, etc.).

### Public directory fields

**Confirmed: no `publicDirectoryOptIn`, `publicDisplayName`, `publicCity`, or `publicState` exist** in shared types, API handlers, or scripts (repo-wide grep in `apps/api` returns no matches).

**Partial overlap with spec intent:** `city` and `state` **do exist** on agency records, but they are **operational slug/locality fields** used at agency creation (`createAgencyBodySchema` in `packages/shared/src/tenancy/schemas.ts` L54–58), not opt-in public directory fields. `scripts/onboard-pilot-customer.ts` L11–38 mirrors the same create shape and has **no public-directory fields**.

`AgencyRepository.put` persists the full `AgencyTenant` object as-is (`apps/api/src/repositories/agencyRepository.ts` L39–46); nothing else patches public-directory attributes elsewhere.

---

## 4. `SalesLeadsTable` schema + existing write path

### Direct answer

**Physical table:** `${DynamoTableNamePrefix}-sales-leads-${DeploymentStage}` — `infra/nested/stack-data-layer.yaml` L2608–2646.

| Element | Value |
|---|---|
| Partition key | `leadId` (HASH) |
| Sort key | None |
| GSIs | **None** |

### Attributes written today

**DynamoDB:** only `leadId` is declared; items are schemaless.

**Application record shape** (`SalesLeadRecord` = `ContactSalesLeadBody` + `leadId` + `createdAt`):

From `packages/shared/src/monetization/schemas.ts` L3–27 and `apps/api/src/repositories/salesLeadRepository.ts` L6–16:

| Field | Validation |
|---|---|
| `name` | string 1–200 |
| `email` | **Zod `.email()`**, max 320 |
| `phone` | optional, max 40 |
| `agencyCompany` | string 1–300 |
| `role` | optional, max 200 |
| `customerType` | enum: `agency`, `city`, `county`, `state`, `venue`, `campus`, `vendor`, `other` |
| `interestedIn` | non-empty array of product-interest enums |
| `estimatedAgencySize` | optional string |
| `message` | optional, max 5000 |
| `website` | optional honeypot (non-empty → silent 202, no write) |
| `leadId` | UUID (server-generated) |
| `createdAt` | ISO timestamp (server-generated) |

**No `source`, `status`, or `stage` field** exists in schema or handler.

### Existing endpoint

| | |
|---|---|
| Route | **`POST /api/contact-sales`** (also OPTIONS) |
| Handler | `apps/api/src/handlers/postContactSalesLead.ts` |
| Auth | **`Authorizer: NONE`** (`infra/nested/stack-app-sam-3.yaml` L1628–1631) |
| Response | **202** `{ ok: true, leadId }` on success; **202** `{ ok: true }` for honeypot |
| Side effects | DynamoDB `putLead`; optional SNS + SES notifications |

**Only write path found:** `postContactSalesLead` → `SalesLeadRepository.putLead`. No scripts write to `SalesLeadsTable`.

---

## 5. Sign-in page — footer line location

### Direct answer

The footer **"Need an account? Contact your admin · Plans · Home"** (with conditional **Sign up** when signup is enabled) lives in:

**`apps/web/app/[jurisdiction]/login/login-form.tsx`** L915–935

Rendered via:

- `apps/web/app/[jurisdiction]/login/login-page-view.tsx` → imports `LoginForm`
- `apps/web/app/[jurisdiction]/login/page.tsx` → server page wrapper

There is also `apps/web/app/login/page.tsx` (global login), but the quoted footer copy is in **`login-form.tsx`**.

### Evidence excerpt

```tsx
        {!activeChallenge && !inForgotRequest && !inForgotConfirm ? (
          <p className="mt-6 text-center text-xs text-slate-500">
            Need an account?{" "}
            {signupEnabled ? (
              <>
                <Link href={marketingSignupPath()} className="text-sky-400 hover:text-sky-300">
                  Sign up
                </Link>
                {" · "}
              </>
            ) : (
              "Contact your admin · "
            )}
            <Link href={marketingPricingPath()} className="text-sky-400 hover:text-sky-300">
              Plans
            </Link>
            {" · "}
            <Link href={marketingHomePath()} className="text-sky-400 hover:text-sky-300">
              Home
            </Link>
          </p>
        ) : null}
```

---

## 6. `/connect/ring/link/` implementation

### Direct answer

| Piece | Path |
|---|---|
| Route page (marketing) | `apps/marketing/app/(marketing)/connect/ring/link/page.tsx` |
| Client UI | `apps/marketing/app/(marketing)/connect/ring/link/ring-link-client.tsx` |
| Post-OAuth API redirect target | `RING_ACCOUNT_LINK_URL` default `https://www.rapidcortex.us/connect/ring/link` (`infra/nested/stack-app-sam-4.yaml` L540, `callback.ts` L20–22) |

### Query param handling

`ring-link-client.tsx` L8–27, L31–33:

| `?status=` | Behavior |
|---|---|
| `success` or `connected` | Success copy (“Ring account linked”) |
| `error` | Error copy |
| **anything else / missing** | Neutral default (“Link your Ring account from the Rapid Cortex app…”) |

**`pending` is not handled explicitly** — it falls through to the neutral default, not a dedicated pending state.

API callback only redirects with `status=success` or `status=error` (`callback.ts` L20–22, L44–62); it never emits `pending`.

---

## 7. SMS consent host mismatch

### Direct answer

**This is primarily a wrong-host / canonical-URL issue, not an auth bug.**

#### `https://www.rapidcortex.us/sms-consent`

- **Source:** `apps/web/app/sms-consent/page.tsx` (content) + `apps/web/app/sms-consent/layout.tsx` (public marketing shell).
- **Marketing route:** `apps/marketing/app/(marketing)/sms-consent/page.tsx` re-exports the web page; marketing `next.config.mjs` aliases `@` → `../web` and uses **`output: "export"`** → static files under **`apps/marketing/out/`** (see `apps/marketing/README.md`).
- With `trailingSlash: true`, built artifact is **`apps/marketing/out/sms-consent/index.html`**.
- **No Cognito session required** on the marketing static site.

#### `https://app.rapidcortex.us/sms-consent`

The SSR web app **does register** `/sms-consent` (`apps/web/app/sms-consent/page.tsx`, reserved segment in `apps/web/lib/reserved-public-route-segments.ts` L34).

**However**, on the app hostname, middleware redirects marketing-class paths to www:

- `apps/web/lib/app-host-routing.ts` L19 (`"sms-consent"` in `MARKETING_ROOT_SEGMENTS`), L131–147 (`maybeRedirectAppHostAwayFromMarketing` → redirect to `https://www.rapidcortex.us/sms-consent` preserving query string).
- Invoked from `apps/web/middleware.ts` L851–852.

**Expected production behavior:** `app.rapidcortex.us/sms-consent` → **302 to `www.rapidcortex.us/sms-consent`**, not a login wall.

**Repo references to `app.rapidcortex.us/sms-consent`:** only in `CURSOR_PROMPT_PUBLIC_RING_CONNECT.md` (no MSA/docx in repo with that URL from this search). Any external MSA link pointing at the app host should be updated to **www**.

---

## 8. Rate-limit utility — `request-camera-access` vs reusable helpers

### Direct answer

**The 5-requests-per-hour limit on `POST /api/integrations/ring/request-camera-access` is implemented inline in the handler**, not via `ring-consent-rate-limit.ts`.

| Aspect | `request-camera-access` limit | `consumeRingConsentRateSlot` |
|---|---|---|
| File | `apps/api/src/integrations/ring/request-camera-access.ts` L91–97 | `apps/api/src/integrations/ring/ring-consent-rate-limit.ts` |
| Used by | `request-camera-access` handler only | `camera-consent.ts` approve/decline (`L55`) |
| Keying | **`agencyId` + `incidentId`** — counts rows for that incident in the last hour via `RingEmergencyRepository.countRequestsSince` | **Client IP** (hashed), 15-minute windows |
| Limit | **5** requests / **60 minutes** / incident | **10** attempts / **15 minutes** / IP |
| Storage | Ring emergency **requests** table (same table as requests; rate rows use `itemType: "ring_consent_rate"`) | Same requests table, synthetic keys `agencyIncidentKey = "__ring_consent_rate__"` |

### Evidence — incident limit (inline)

`apps/api/src/integrations/ring/request-camera-access.ts` L91–97:

```typescript
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentCount = await emergencyRepo.countRequestsSince(user.agencyId, incidentId, sinceIso);
    if (recentCount >= 5) {
      return ringJson(
        { success: false, error: "Request limit reached for this incident." },
        429,
      );
    }
```

`countRequestsSince` — `apps/api/src/repositories/ringEmergencyRepository.ts` L138–145: lists requests for `(agencyId, incidentId)` and filters `createdAt >= sinceIso`.

### Evidence — IP consent limit (reusable utility)

`apps/api/src/integrations/ring/ring-consent-rate-limit.ts` L6–7, L13–17, L19–42:

```typescript
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
// ...
function windowKey(ip: string): string {
  const windowStart = Math.floor(Date.now() / WINDOW_MS);
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  return `ring-consent-rate#${ipHash}#${windowStart}`;
}
```

### Implication for new public endpoints

- **`by-state` / public `oauth/start` / waitlist `leads`:** cannot reuse the incident limit as-is (wrong key dimensions).  
- **Public endpoints may reuse `consumeRingConsentRateSlot` pattern** (per-IP, 15m/10) or need a new IP-keyed helper with different thresholds.  
- **Waitlist** might align better with existing **`POST /api/contact-sales`** (unauthenticated, Zod-validated) than with Ring consent rate rows.

---

## Reference: isolation test pattern (for later implementation)

`scripts/cross-agency-isolation-test.ts` authenticates with real Cognito JWTs for two agencies and asserts **403/404** on cross-tenant Ring routes (e.g. L384: agency B token against agency A’s `/api/integrations/ring/devices`). Use as the template for public-flow isolation tests after `RINGOWNER` / public routes exist.

---

## Stop line

Step 0 complete. **Do not implement Requirements A.1, A.2, B, or C** until these findings are reviewed — especially route naming (`/login` vs `/oauth/start`), Ring token storage (Secrets Manager vs `camera-provider-tokens`), and rate-limit reuse.
