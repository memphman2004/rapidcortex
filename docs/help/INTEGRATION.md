# Rapid Cortex — Help Panel Integration Guide

## Files

```
components/help/
  help-panel-context.tsx   — Provider + useHelpPanel() hook
  help-panel.tsx           — Slide-out drawer (renders itself)
  help-button.tsx          — HelpButton (header) + ContextualHelp (feature ?)

lib/help/
  help-content.ts          — Role → article index map (all 18 roles)
  fetch-help-article.ts    — S3/CDN fetcher + markdown → HTML renderer
```

---

## Step 1 — Environment variable

Add to `scripts/env-web-ssr-prod.sh`:
```bash
# Help content CDN — serve articles from CloudFront/S3
# For local dev, omit this and place .md files under public/help/{role}/{topic}.md
export NEXT_PUBLIC_HELP_CDN_BASE="https://cdn.rapidcortex.us/help"
```

---

## Step 2 — Wrap each dashboard shell with the provider

Prefer the thin wrapper already in the repo:

```tsx
import { HelpChrome } from "@/components/help/help-chrome";

export function VenueOperationsShell({ userRole, ...props }) {
  return (
    <HelpChrome role={userRole ?? "VENUE_ADMIN"}>
      {/* shell UI — HelpButton is included in CampusDashboardHeaderUtilities */}
    </HelpChrome>
  );
}
```

`CampusDashboardHeaderUtilities` already renders `<HelpButton />`. Do not add a second header HelpButton next to it.

`HelpChrome` is wired on: dispatch shell, dashboard shell, venue operations shell, campus/venue layouts, campus safety/admin dashboards, hospital admin layout, guest-services frame, and vertical role stubs.

---

## Step 3 — Add contextual ? icons next to features

```tsx
import { ContextualHelp } from "@/components/help/help-button";

// In the silent text panel header:
<div style={{ fontSize: 10, fontWeight: 700 }}>
  SILENT TEXT LINK
  <ContextualHelp topic="silent-text" />
</div>

// In the SOP protocol section:
<div>SOP-AWARE PROTOCOL <ContextualHelp topic="sop-protocol" /></div>

// In the live video section:
<div>CALLER VIDEO ASSIST <ContextualHelp topic="live-video" /></div>

// In the pinpoint section:
<div>RAPID CORTEX PINPOINT <ContextualHelp topic="pinpoint" /></div>

// In the CAD entry form:
<label>CAD ENTRY <ContextualHelp topic="cad-entry" /></label>
```

The topic string must match a `topic` field in `lib/help/help-content.ts` for the user's role.

---

## Step 4 — Upload help articles to S3

### S3 bucket setup (one time)

```bash
AWS_PROFILE=rapid-cortex REGION=us-east-1 STAGE=prod bash scripts/setup-help-s3.sh
```

Creates `rapid-cortex-help-prod`, blocks public access, enables versioning, seeds all 20 role folders with `README.md` placeholders, and uploads `docs/help/dispatcher/silent-text.md` when present.

### CloudFront (one time)

```bash
AWS_PROFILE=rapid-cortex STAGE=prod bash scripts/setup-help-cloudfront.sh
```

Creates OAC + distribution for the help bucket and prints:

```bash
export NEXT_PUBLIC_HELP_CDN_BASE="https://<cf-domain>/help"
```

Add that line to `scripts/env-web-ssr-prod.sh`.

### Uploading articles

```bash
# From repo root — upload a dispatcher article
aws s3 cp docs/help/dispatcher/silent-text.md \
  s3://rapid-cortex-help-prod/help/dispatcher/silent-text.md \
  --content-type text/markdown \
  --cache-control "max-age=300, s-maxage=300"

# Upload all articles at once (skip the integration guide)
aws s3 sync docs/help/ s3://rapid-cortex-help-prod/help/ \
  --exclude 'INTEGRATION.md' --exclude '*/INTEGRATION.md' \
  --content-type text/markdown \
  --cache-control "max-age=300"
```

### Article filename convention

```
help/{normalizedRole}/{topic}.md
```

Where `normalizedRole` matches the key in `lib/help/help-content.ts`:
- `dispatcher`, `supervisor`, `agencyadmin`, `agencyit`, `analyst`, `auditor`
- `campus_admin`, `campus_supervisor`, `campus_security`, `campus_counselor`, `campus_faculty`
- `venue_admin`, `venue_supervisor`, `venue_security`
- `hospital_admin`, `hospital_staff`
- `transit_admin`, `transit_security`
- `rcadmin`, `rcitadmin`

---

## Step 5 — Local development (no S3 needed)

Place `.md` files under `apps/web/public/help/{role}/{topic}.md`.
When `NEXT_PUBLIC_HELP_CDN_BASE` is not set, the fetcher uses `/help` as the base,
which resolves to Next.js's `/public/help/` directory.

```
apps/web/public/help/
  dispatcher/
    index.md
    silent-text.md
    live-video.md
    sop-protocol.md
    pinpoint.md
    cad-entry.md
    translation.md
  supervisor/
    index.md
    cad-approval.md
    ...
```

---

## Article markdown format

Keep articles short and operational — dispatchers read these during a shift.

```markdown
# Silent Text Link

Use Silent Text when the caller cannot speak safely and needs to communicate by text only.

## When to use it

- Domestic violence situations where speaking could escalate the call
- Calls where the caller is hiding and cannot make noise
- Any situation where the caller signals they cannot talk

## How to send a Silent Text Link

1. Open the incident in your workspace.
2. Scroll to **SILENT TEXT LINK** in the right panel.
3. Confirm the caller's mobile number in E.164 format (e.g. +14045551234).
4. Click **Send Silent Text Link**.
5. The caller receives an SMS with a one-time secure link.
6. When the caller opens the link, a text session appears in your workspace.

## What the caller sees

The caller receives a plain SMS with a link. No app download required.
The link opens in their browser and shows a simple text interface.

## Session log

Every message is logged to the incident audit trail automatically.
```

---

## Adding a new article to the index

1. Add an entry to `lib/help/help-content.ts` under the relevant role.
2. Upload the `.md` file to S3.
3. Deploy is not required — content is fetched at runtime.

## Adding a new role

1. Add a `const MY_ROLE_HELP: HelpIndex = [...]` block in `lib/help/help-content.ts`.
2. Add an entry to `HELP_INDEX` and `normalizeHelpRole()` in the same file.
3. Upload articles to S3 under `help/my_role/`.
