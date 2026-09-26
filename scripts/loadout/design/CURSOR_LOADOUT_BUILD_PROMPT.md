# NexCortiQ Loadout — Complete Implementation Prompt
## Cursor Composer Agent Mode · Apps on Demand LLC

---

## ⚠️ HARD RULES — READ BEFORE TOUCHING ANY FILE

1. **AWS profile:** every `aws` and `sam` CLI command uses `--profile rapid-cortex` (account `158961537080`, `us-east-1`). Never use the default profile.
2. **SAM build location:** always set `SAM_BUILD_DIR="$HOME/.rapid-cortex-sam-build"`. Never build to an external volume or the repo root.
3. **All monetary values in cents** (integer). Never store floats for money. Loadout `monthlyBase` and `overagePer1k` in the feature catalog are in **fractional dollars for human readability only** — convert to cents for all DynamoDB writes and invoice math.
4. **`verifyJwt` + RBAC on every portal handler.** The Loadout portal API handlers (Next.js route handlers) use the existing `verifyJwt` middleware. The Loadout external API (API Gateway + authorizer Lambda) uses the custom SHA-256 key authorizer — never Cognito.
5. **Never hardcode `tenantId`, `agencyId`, or any customer-specific string.** All agency-specific values resolve at runtime from DynamoDB config.
6. **Feature flags:** every partially-built or suspended feature gets `ENABLE_LOADOUT_<X>` (API) and `NEXT_PUBLIC_ENABLE_LOADOUT_<X>` (web). Default to enabled when unset via the existing `featureEnabled()` helper.
7. **`AWS::NoValue` only at statement level in SAM/CF templates.** Never inside `Resource:` lists — IAM rejects empty resource arrays. Use `!If` at the full `Statement` level when conditionally omitting an IAM statement.
8. **7-year TTL on invoice records** (regulatory retention). Set `ttl` = `Math.floor(Date.now()/1000) + 60*60*24*365*7` on every invoice DynamoDB write.
9. **The Loadout external API runs on a separate REST API Gateway** — not the existing HttpApi. It needs REQUEST-type Lambda authorization (not Cognito JWT). Do not attach the Loadout authorizer to any existing HttpApi routes.
10. **Zsh / inline `#` comments:** strip all bash comments before pasting multi-line commands. Jeff's Mac Mini zsh does not tolerate inline `#` in multi-line pastes.
11. **Build order is strict.** Each step has a GATE condition. Do not proceed to the next step until the GATE passes. Log clearly when each gate passes.
12. **`ConditionExpression: "attribute_not_exists(pk)"` on all initial DynamoDB PutItem writes** — never overwrite existing records silently.

---

## STEP 0 — MANDATORY CODEBASE AUDIT (run first, output summary before touching anything)

Read every file listed below in full before writing a single line of code. Your audit output must confirm each file was read and list the key patterns extracted.

```
packages/shared/src/billing/addon-types.ts          ← ADDON_KEYS, AddonKey, requireAddon pattern
packages/shared/src/billing/addon-catalog.ts         ← ADDON_CATALOG structure
packages/shared/src/billing/pricing-defaults.ts      ← PRICING_DEFAULTS structure
apps/web/lib/pricing/pricing-catalog.ts              ← web pricing catalog
infra/template.yaml                                  ← parent stack, nested stack wiring pattern
infra/stack-data-layer.yaml                          ← DynamoDB table definitions, output export names
infra/stack-app-sam-2-rcs.yaml                       ← canonical Lambda SAM nested stack example
apps/api/src/rcs/                                    ← canonical Lambda handler pattern (RCS)
apps/web/app/{jurisdiction}/rcs/                     ← canonical Next.js page pattern (RCS monitor)
scripts/seed-test-agency-dev.ts                      ← DynamoDB seed script pattern
scripts/seed-tenant-entitlements-dev.ts              ← billing profile + entitlements seed pattern
scripts/seed-billing-customers.sh                    ← billing customer seed pattern
packages/shared/src/auth/                            ← verifyJwt, UserContext, role types
```

Also read the following **design reference files** (these are the source of truth for what to build — adapt them to fit the monorepo patterns you found above):

```
scripts/loadout/design/loadout-features.ts           ← LOADOUT_FEATURES catalog, featureLineCost(), ENDPOINT_FEATURE_MAP
scripts/loadout/design/loadout-authorizer.ts         ← Lambda authorizer design
scripts/loadout/design/loadout-invoice-generator.ts  ← Invoice generator Lambda design
scripts/loadout/design/loadout-subscription-manager.ts ← Subscription manager Lambda design
scripts/loadout/design/loadout-sam-template.yaml     ← SAM infrastructure design
scripts/loadout/design/LOADOUT-PRICING-GUIDE.md      ← Pricing model, DynamoDB schema reference
```

> **Note for Cursor:** the design files above will be placed in `scripts/loadout/design/` before you run. If they are not there, ask Jeff to place them before proceeding.

**Audit gate:** paste a one-paragraph summary of:
- How existing Lambda handlers are structured in `apps/api/src/`
- How the existing `stack-data-layer.yaml` exports table names to nested stacks
- How `infra/template.yaml` wires in nested SAM stacks
- What `requireAddon()` does and whether Loadout should use it
- What `verifyJwt` returns and how to use it in portal route handlers

Do not proceed to Step 1 until this audit summary is written.

---

## CONTEXT — What You Are Building

**NexCortiQ Loadout** is a composable, self-serve, per-feature API licensing platform for public safety agencies. It lets agencies activate individual AI features (transcription, translation, incident analysis, etc.) immediately, pay only for what they use, and manage everything through a portal.

The Loadout system has **two separate access patterns**:

| Access Path | Auth | Who Uses It |
|---|---|---|
| **External API** (`api.nexcortiq.us/v1/*`) | SHA-256 API key → Lambda authorizer | Agency developers, CAD vendors, third-party integrators |
| **Loadout Portal** (`app.nexcortiq.us/loadout`) | Existing Cognito JWT → verifyJwt | RC admins, tenant admins managing their subscription |

These are **architecturally separate** — do not conflate them.

The Loadout system is **independent of the existing addon system** (`ADDON_KEYS`, `requireAddon`). It has its own DynamoDB tables, its own billing model (per-feature monthly base + per-call overage), and its own API Gateway. Do not try to express Loadout features as addon keys.

---

## MONOREPO INTEGRATION RULES

Follow these patterns exactly. Do not invent new patterns.

```
packages/shared/src/loadout/           ← new shared package for Loadout types
  features.ts                          ← LOADOUT_FEATURES catalog (adapt from design file)
  types.ts                             ← LoadoutFeature, LoadoutSubscription, LoadoutInvoice etc.
  index.ts                             ← barrel export

apps/api/src/loadout/                  ← Lambda function handlers
  authorizer.ts                        ← API Gateway REQUEST-type authorizer
  subscription-manager.ts              ← Subscription CRUD (add/remove features, enterprise requests)
  invoice-generator.ts                 ← Monthly invoice generation + SES email
  key-provisioner.ts                   ← Admin-only: create/revoke API keys (not exposed via API GW)

infra/
  stack-data-layer-loadout.yaml        ← New nested stack: 5 Loadout DynamoDB tables
  stack-app-sam-loadout.yaml           ← New nested SAM stack: Lambdas + REST API GW + EventBridge
  template.yaml                        ← ADD: LoadoutDataStack + LoadoutAppStack nested stacks

apps/web/app/(loadout)/
  loadout/
    page.tsx                           ← Dashboard (redirect to /loadout/dashboard)
    dashboard/page.tsx                 ← Active features, usage meters, invoice preview
    catalog/page.tsx                   ← Feature catalog (add/remove/schedule call)
    invoices/page.tsx                  ← Invoice history table
    keys/page.tsx                      ← API key management
    layout.tsx                         ← Loadout shell (nav, sidebar, auth guard)
  api/loadout/
    features/route.ts                  ← GET active features with usage
    features/add/route.ts              ← POST add feature
    features/remove/route.ts           ← POST remove feature
    invoice/preview/route.ts           ← GET projected invoice
    enterprise/request/route.ts        ← POST enterprise provisioning request

scripts/
  provision-loadout-key.ts             ← Admin: create API key for a tenant
  seed-loadout-dev.ts                  ← Dev: create test Loadout subscription + API key
  smoke-loadout.sh                     ← Smoke test: hit each licensed endpoint, verify 403 on unlicensed
```

**Table naming follows existing convention:** prefix `rapid-cortex-loadout-*-${Stage}`.

---

## BUILD STEPS

### STEP 1 — Shared Types Package
**GATE:** `grep -r "LoadoutFeature" packages/shared/src/loadout/types.ts` returns a result.

Create `packages/shared/src/loadout/types.ts`:

```typescript
export type FeatureCategory = 'core' | 'intelligence' | 'quality' | 'field' | 'automation' | 'enterprise';

export interface LoadoutFeature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  enterprise: boolean;
  /** Monthly base charge in CENTS. null = custom pricing (enterprise, full platform). */
  monthlyBaseCents: number | null;
  /** Calls included in monthly base. null = flat-rate (no per-call billing). */
  includedCalls: number | null;
  /** Overage rate per 1,000 calls in CENTS. null = no overage model. */
  overagePer1kCents: number | null;
  endpoint: string | null;
  enterpriseNote?: string;
}

export interface LoadoutSubscription {
  tenantId: string;
  orgName: string;
  activeFeatures: string[];           // featureId[]
  billingEmail: string;
  technicalEmail: string;
  billingCycleDay: number;            // 1-28
  tier: 'small' | 'medium' | 'large' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  version: number;                    // optimistic concurrency
  createdAt: string;
  updatedAt: string;
}

export interface LoadoutKeyRecord {
  keyHash: string;                    // SHA-256 of raw key — raw key never stored
  tenantId: string;
  keyName: string;
  status: 'active' | 'suspended' | 'revoked';
  tier: string;
  enabledFeatures: string[];
  /** Per-feature quota limits. Key = featureId, value = max calls/period (integer). */
  quotaPerFeature: Record<string, number>;
  /** Per-feature current-period usage. Key = featureId, value = call count (integer). */
  usageThisMonth: Record<string, number>;
  allowedJurisdictions: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface LoadoutUsageRecord {
  tenantId: string;
  featureId: string;
  period: string;                     // "YYYY-MM"
  callCount: number;
  quotaLimit: number;
  ttl: number;                        // epoch seconds — 13 months
}

export interface LoadoutInvoiceLineItem {
  featureId: string;
  featureName: string;
  baseCents: number;
  callsUsed: number;
  callsIncluded: number | null;
  overageCents: number;
  totalCents: number;
}

export interface LoadoutInvoice {
  invoiceId: string;
  tenantId: string;
  orgName: string;
  period: string;                     // "YYYY-MM"
  billingEmail: string;
  technicalEmail: string;
  lineItems: LoadoutInvoiceLineItem[];
  subtotalCents: number;
  totalDueCents: number;
  generatedAt: string;
  status: 'generated' | 'sent' | 'preview' | 'void';
  dueDate: string;
  ttl: number;                        // epoch seconds — 7 years (regulatory)
}
```

Create `packages/shared/src/loadout/features.ts` — adapt from the design file at `scripts/loadout/design/loadout-features.ts`. **Critical adaptation:** convert all `monthlyBase` dollar values to `monthlyBaseCents` (multiply by 100), all `overagePer1k` to `overagePer1kCents` (multiply by 100). Also add:

```typescript
/** Calculate invoice line total for one feature. All values in CENTS. */
export function featureLineCost(
  featureId: string,
  callsUsed: number
): { baseCents: number; overageCents: number; totalCents: number } {
  const f = LOADOUT_FEATURES[featureId];
  if (!f || !f.monthlyBaseCents) return { baseCents: 0, overageCents: 0, totalCents: 0 };
  const baseCents = f.monthlyBaseCents;
  const overageCents =
    f.includedCalls && f.overagePer1kCents && callsUsed > f.includedCalls
      ? Math.ceil(((callsUsed - f.includedCalls) / 1000) * f.overagePer1kCents)
      : 0;
  return { baseCents, overageCents, totalCents: baseCents + overageCents };
}
```

Create `packages/shared/src/loadout/index.ts` barrel export.

Add `"./loadout"` to the `packages/shared` package.json exports map.

---

### STEP 2 — Data Layer (DynamoDB Tables)
**GATE:** `grep "LoadoutSubscriptionsTable" infra/stack-data-layer-loadout.yaml` returns a result AND the file has no YAML lint errors (`sam validate --template infra/stack-data-layer-loadout.yaml` passes or at minimum Python `yaml.safe_load` succeeds).

Create `infra/stack-data-layer-loadout.yaml` as a SAM/CF nested stack defining exactly **5 DynamoDB tables**. Model after the existing `infra/stack-data-layer.yaml` patterns (parameters, outputs, PITR, SSE, DeletionPolicy: Retain).

Table specs (follow the schema from `scripts/loadout/design/LOADOUT-PRICING-GUIDE.md`):

| Logical Name | Physical Name | PK | SK | Notes |
|---|---|---|---|---|
| `LoadoutSubscriptionsTable` | `rapid-cortex-loadout-subscriptions-${Stage}` | `pk = SUB#{tenantId}` | `sk = SUBSCRIPTION` | DeletionPolicy: Retain, PITR: true |
| `LoadoutApiKeysTable` | `rapid-cortex-loadout-api-keys-${Stage}` | `pk = APIKEY#{keyHash}` | — | GSI on `tenantId`. DeletionPolicy: Retain, PITR: true |
| `LoadoutUsageTable` | `rapid-cortex-loadout-usage-${Stage}` | `pk = USAGE#{tenantId}#{YYYY-MM}` | `sk = FEATURE#{featureId}` | TTL attr: `ttl`. DeletionPolicy: Retain |
| `LoadoutSwapHistoryTable` | `rapid-cortex-loadout-swap-history-${Stage}` | `pk = SWAP#{tenantId}` | `sk = {ISO}#{uuid}` | DeletionPolicy: Retain |
| `LoadoutInvoicesTable` | `rapid-cortex-loadout-invoices-${Stage}` | `pk = INV#{tenantId}` | `sk = PERIOD#{YYYY-MM}` | TTL attr: `ttl` (7yr). DeletionPolicy: Retain, PITR: true |

All tables: `BillingMode: PAY_PER_REQUEST`, `SSESpecification.SSEEnabled: true`.

Export every table name and ARN as CloudFormation outputs following the pattern from `stack-data-layer.yaml`.

---

### STEP 3 — Wire Data Layer into Parent Template
**GATE:** `grep "LoadoutDataStack" infra/template.yaml` returns a result.

In `infra/template.yaml`, add `LoadoutDataStack` as a nested stack pointing to `stack-data-layer-loadout.yaml`, passing `Stage` parameter. Add it in the correct position (after the main data layer stack, before any app stacks that need it). Pass the LoadoutDataStack outputs as parameters to LoadoutAppStack in Step 6.

---

### STEP 4 — Lambda Implementations
**GATE:** `grep -r "sha256" apps/api/src/loadout/authorizer.ts` returns a result AND `grep -r "featureLineCost" apps/api/src/loadout/invoice-generator.ts` returns a result.

Create four Lambda handler files in `apps/api/src/loadout/`. Adapt from the design files — follow the existing Lambda handler patterns in `apps/api/src/rcs/` for:
- How env vars are read (`process.env.TABLE?.trim() || throw`)
- How DynamoDB clients are instantiated (reuse existing `ddb` client pattern)
- How errors are logged (`console.error(JSON.stringify({...}))`)
- How responses are structured (match existing HTTP response helpers)

#### 4a. `apps/api/src/loadout/authorizer.ts`
Adapt from design file. **Critical:** this is a **REST API Gateway REQUEST-type authorizer** (not HttpApi). It returns an IAM policy document (`APIGatewayAuthorizerResult`), not a simple allow/deny boolean. The cache key is the `x-api-key` header value.

Key implementation points:
- SHA-256 hash of raw key — never log the plaintext key
- `ENDPOINT_FEATURE_MAP` lookup from `packages/shared/src/loadout/features.ts`
- DynamoDB `GetItem` on `LoadoutApiKeysTable` (pk = `APIKEY#{keyHash}`)
- Atomic `UpdateItem ADD :one` on `LoadoutUsageTable` (fire-and-forget, non-blocking)
- Returns `ALLOW` with context: `{tenantId, featureId, tier, quotaRemaining, jurisdictions}`
- Returns `DENY` with context: `{error_code, message, feature, upgrade_url}` for all failure modes
- **Authorizer TTL:** 30 seconds (set in SAM template, not in code)
- **Never** emit the raw API key in any log, error, or context value

Env vars the authorizer needs (passed from SAM):
```
API_KEYS_TABLE    — from LoadoutApiKeysTable output
USAGE_TABLE       — from LoadoutUsageTable output
AWS_REGION        — injected automatically by Lambda runtime
```

#### 4b. `apps/api/src/loadout/subscription-manager.ts`
Adapt from design file. This is an HttpApi handler (not authorizer). Routes:
- `GET  /loadout/features` — list active features with live usage
- `POST /loadout/features/add` — activate a self-serve feature
- `POST /loadout/features/remove` — deactivate a feature
- `POST /loadout/enterprise/request` — submit enterprise provisioning request → SNS
- `GET  /loadout/invoice/preview` — projected current period invoice

All reads/writes use `LoadoutSubscriptionsTable`, `LoadoutApiKeysTable`, `LoadoutUsageTable`, `LoadoutSwapHistoryTable`. Optimistic concurrency on subscription updates (version counter + conditional expression).

Env vars:
```
SUBSCRIPTIONS_TABLE  APIKEYS_TABLE  USAGE_TABLE  SWAP_HISTORY_TABLE
OPS_SNS_TOPIC_ARN    AWS_REGION
```

#### 4c. `apps/api/src/loadout/invoice-generator.ts`
Adapt from design file. EventBridge-triggered. Full flow:
1. Idempotency check — `GetItem` on `LoadoutInvoicesTable`. If exists, re-send email and return.
2. Load subscription features + usage
3. Calculate line items using `featureLineCost()` from shared package
4. Conditional `PutItem` on `LoadoutInvoicesTable` (`attribute_not_exists(pk)` guard)
5. Send HTML + plaintext invoice via SESv2 (to billingEmail + technicalEmail + `ADMIN_EMAIL`)
6. Reset usage counters (`UpdateItem SET callCount = 0`)
7. Emit CloudWatch `PutMetricData` for revenue tracking (`NexCortiQ/Loadout` namespace, `InvoiceRevenue` metric)

**All invoice amounts stored in cents.** The HTML email renders cents as formatted dollars (`$${(cents/100).toFixed(2)}`).

**Invoice TTL:** `Math.floor(Date.now()/1000) + 60*60*24*365*7` (7 years).

Env vars:
```
SUBSCRIPTIONS_TABLE  INVOICES_TABLE  USAGE_TABLE
FROM_EMAIL           ADMIN_EMAIL     AWS_REGION
```

#### 4d. `apps/api/src/loadout/key-provisioner.ts`
Admin-only script (not exposed via API Gateway). Generates a new API key for a tenant.

```typescript
// Usage: TENANT_ID=acme-county npx tsx apps/api/src/loadout/key-provisioner.ts
// Prints: raw key ONCE to stdout — never stored in DB
```

Flow:
1. Generate raw key: `ncq_live_${randomBytes(32).toString('hex')}`
2. SHA-256 hash the raw key
3. Build `quotaPerFeature` from `LOADOUT_FEATURES` for the requested feature list
4. `PutItem` to `LoadoutApiKeysTable` with hash (NOT raw key)
5. Print raw key to stdout exactly once — operator must store it securely

---

### STEP 5 — SAM App Template (API Gateway + Lambdas + EventBridge)
**GATE:** `sam validate --template infra/stack-app-sam-loadout.yaml` exits 0 (or at minimum YAML is valid and all `!ImportValue` references resolve to outputs exported by `LoadoutDataStack`).

Create `infra/stack-app-sam-loadout.yaml`. Model after `infra/stack-app-sam-2-rcs.yaml`.

Key requirements:
- **Separate REST API Gateway** (not HttpApi) for the external `/v1/*` routes
- REQUEST-type Lambda authorizer attached to the REST API with `ResultTtlInSeconds: 30`
- All `!ImportValue` table name references must match the export names from `stack-data-layer-loadout.yaml`
- EventBridge `ScheduleExpression: cron(0 8 1 * ? *)` for monthly invoice, enabled only in prod (`IsProd` condition)
- `ReservedConcurrentExecutions: 10` on invoice generator (prevent runaway billing)
- Lambda runtime: `nodejs22.x`, `arm64` architecture
- All env vars read from SSM Parameter Store OR passed as CloudFormation parameters — never hardcoded
- DLQ on the invoice generator (SQS dead letter queue)
- `x-api-key` identity source on the authorizer (not `method.request.header.Authorization`)

Gateway response templates — configure `ACCESS_DENIED` and `UNAUTHORIZED` to return the structured JSON error format:
```json
{
  "success": false,
  "error": "$context.authorizer.error_code",
  "message": "$context.authorizer.message",
  "feature": "$context.authorizer.feature",
  "upgrade_url": "$context.authorizer.upgrade_url",
  "request_id": "$context.requestId"
}
```

CloudWatch Alarms (3 required):
1. Authorizer error rate > 10 errors in 5 minutes → SNS alert
2. Invoice generator any error → SNS alert (severity: critical — fires on any single error)
3. `quota_exceeded` custom metric > 100 in 1 hour → SNS upsell alert

Outputs to export:
- `LoadoutApiEndpoint` — the base URL for external API calls
- `LoadoutAuthorizerArn` — for attaching to future feature Lambdas
- `LoadoutInvoiceGeneratorFunctionName` — for manual admin invocations

---

### STEP 6 — Wire App Template into Parent Template
**GATE:** `grep "LoadoutAppStack" infra/template.yaml` returns a result AND `LoadoutDataStack` outputs are passed as parameters to `LoadoutAppStack`.

In `infra/template.yaml`:
1. Add `LoadoutDataStack` (data tables — Step 3 already done)
2. Add `LoadoutAppStack` (Lambdas + API GW) passing table name outputs from `LoadoutDataStack`
3. Add `LoadoutApiEndpoint` and `LoadoutAuthorizerArn` as outputs of the parent template

---

### STEP 7 — Portal Next.js Pages
**GATE:** `find apps/web/app -name "*.tsx" -path "*/loadout/*" | wc -l` returns >= 6.

Create the Loadout portal in `apps/web/app/(loadout)/loadout/`. The portal is accessible to authenticated RC users (dispatchers, supervisors, agencyadmins) — use the existing auth layout pattern.

#### 7a. `apps/web/app/(loadout)/loadout/layout.tsx`
- Auth guard using existing `requireAuth()` or equivalent session pattern
- Loadout-specific sidebar nav (Dashboard, Catalog, Invoices, API Keys)
- Top bar: NexCortiQ Loadout brand, account name, system status
- Cost module in sidebar showing current period estimated total (fetched client-side)

#### 7b. `apps/web/app/(loadout)/loadout/dashboard/page.tsx`
Server component with client island for interactivity:
- Console strip: 7 feature status panels (LIVE/OFF, call count, usage bar)
- Stats row: active features count, total API calls, monthly base, projected total
- Active features list: each with usage meter, endpoint, cost
- Invoice preview panel: live line items + total due

#### 7c. `apps/web/app/(loadout)/loadout/catalog/page.tsx`
- Filter bar: All, Core, Intelligence, Quality, Field, Automation, Enterprise
- Feature cards grid: self-serve (Add to Loadout button) vs. enterprise (Schedule a Call)
- Pro-rata cost preview on add modal
- Enterprise request modal with contact form

#### 7d. `apps/web/app/(loadout)/loadout/invoices/page.tsx`
- Invoice history table: period, invoice #, features, calls, amount, status
- Current period "in progress" row at top
- Download PDF button (generate client-side using existing PDF utilities if available, otherwise placeholder)

#### 7e. `apps/web/app/(loadout)/loadout/keys/page.tsx`
- Production key display (last 6 chars visible, rest masked)
- Copy button (clipboard API)
- Feature scope tags
- Rotate / Revoke actions (POST to route handler → Lambda)
- Key scoping explanation

#### 7f. Shared components: `apps/web/app/(loadout)/loadout/_components/`
- `LoadoutConsoleStrip.tsx` — horizontal feature status strip
- `FeatureUsageCard.tsx` — usage meter card
- `InvoicePreviewPanel.tsx` — invoice line items panel
- `CatalogFeatureCard.tsx` — catalog card with CTA
- `AddFeatureModal.tsx` — confirm add with pro-rata cost
- `EnterpriseRequestModal.tsx` — enterprise call request form

**Design tokens for Loadout portal** (dark theme, consistent with existing RC dark UI):
```css
--bg: #06080E;         /* deep bg */
--surface: #0B0F18;    /* card bg */
--surface-2: #101622;  /* elevated */
--border: #1A2333;
--border-2: #222E42;
--blue: #3B82F6;
--amber: #F59E0B;       /* billing/invoice accent */
--green: #10B981;
--red: #EF4444;
--font: 'DM Sans', system-ui, sans-serif;
--mono: 'JetBrains Mono', monospace;
```

---

### STEP 8 — Portal Route Handlers (API Layer)
**GATE:** `find apps/web/app/api/loadout -name "route.ts" | wc -l` returns >= 5.

Create Next.js route handlers. Every handler must:
1. Call `verifyJwt(request)` → get `UserContext` (follow existing pattern)
2. Extract `tenantId` from `user.agencyId` (Loadout tenant = agency)
3. Call the appropriate Loadout Lambda via `InvokeCommand` (AWS SDK Lambda invoke) OR directly call the DynamoDB operations if co-locating logic in the route handler is more appropriate for your codebase
4. Return structured JSON response

Route handlers:

```
apps/web/app/api/loadout/features/route.ts          → GET → list active features + usage
apps/web/app/api/loadout/features/add/route.ts      → POST → add feature, body: { featureId }
apps/web/app/api/loadout/features/remove/route.ts   → POST → remove feature, body: { featureId }
apps/web/app/api/loadout/invoice/preview/route.ts   → GET → projected invoice for current period
apps/web/app/api/loadout/enterprise/request/route.ts → POST → submit enterprise request
```

**Choice:** if the codebase colocates Lambda business logic in route handlers (check existing RCS patterns), implement the DynamoDB reads/writes directly in the route handler. If it invokes Lambda via SDK, do that. Match whatever pattern is used for RCS.

---

### STEP 9 — Admin Scripts
**GATE:** `grep -r "ncq_live_" scripts/provision-loadout-key.ts` returns a result.

#### `scripts/provision-loadout-key.ts`
Interactive admin script to provision a new Loadout API key for an agency.

```
Usage:
  TENANT_ID=fulton-county-911 \
  ORG_NAME="Fulton County 911" \
  BILLING_EMAIL=billing@fultoncountyga.gov \
  TECH_EMAIL=it@fultoncountyga.gov \
  FEATURES=transcription,ai_analysis,qa_scoring \
  STAGE=dev \
  npx tsx scripts/provision-loadout-key.ts
```

Steps:
1. Validate all required env vars
2. Upsert subscription record in `LoadoutSubscriptionsTable`
3. Generate API key: `ncq_${stage === 'prod' ? 'live' : 'test'}_${randomBytes(32).toString('hex')}`
4. Hash with SHA-256
5. PutItem to `LoadoutApiKeysTable` (hash + quotas + enabledFeatures)
6. Print raw key to stdout **exactly once** with a prominent warning: `⚠ STORE THIS KEY NOW — IT WILL NOT BE SHOWN AGAIN`

#### `scripts/seed-loadout-dev.ts`
Seeds a complete Loadout setup for the `test-agency` tenant in dev. Creates:
- Subscription record with features: `['transcription', 'ai_analysis', 'qa_scoring']`
- API key (prints raw key)
- Usage records with realistic mock data (7,842 / 3,210 / 2,901 calls this period)

```
Usage: STAGE=dev npx tsx scripts/seed-loadout-dev.ts
```

---

### STEP 10 — SSM Parameter Store (Secrets)
**GATE:** `aws ssm get-parameter --name "/rapid-cortex/loadout/from-email" --profile rapid-cortex` exits 0 in dev environment.

Create SSM parameters for sensitive values (do NOT hardcode in template):
```
/rapid-cortex/loadout/from-email        → billing@nexcortiq.us (or rapidcortex.us in dev)
/rapid-cortex/loadout/admin-email       → ops@nexcortiq.us
/rapid-cortex/loadout/ops-sns-topic-arn → (set after SNS topic is created by CF)
```

Add a setup script `scripts/setup-loadout-ssm.sh`:
```bash
#!/usr/bin/env bash
STAGE="${STAGE:-dev}"
REGION="us-east-1"
PROFILE="rapid-cortex"
aws ssm put-parameter --profile $PROFILE --region $REGION \
  --name "/rapid-cortex/loadout/from-email" \
  --value "billing@rapidcortex.us" \
  --type String --overwrite
```

---

### STEP 11 — Smoke Test Script
**GATE:** `bash scripts/smoke-loadout.sh` exits 0 against dev environment.

Create `scripts/smoke-loadout.sh`:

```bash
#!/usr/bin/env bash
# NexCortiQ Loadout smoke test
# Requires: LOADOUT_API_KEY (from provision-loadout-key.ts), LOADOUT_API_URL (from CF output)
set -euo pipefail

API="${LOADOUT_API_URL:?Set LOADOUT_API_URL}"
KEY="${LOADOUT_API_KEY:?Set LOADOUT_API_KEY}"

echo "[smoke-loadout] Testing licensed endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/transcribe" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"audioData":"dGVzdA==","language":"en-US"}')
[ "$STATUS" = "200" ] || [ "$STATUS" = "422" ] && echo "[smoke-loadout] ✓ Licensed endpoint: $STATUS"

echo "[smoke-loadout] Testing unlicensed endpoint returns 403..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/translate" \
  -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"text":"hello"}')
[ "$STATUS" = "403" ] && echo "[smoke-loadout] ✓ Unlicensed endpoint correctly returns 403"

echo "[smoke-loadout] Testing invalid key returns 401..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/transcribe" \
  -H "x-api-key: ncq_live_invalidkey123" -H "Content-Type: application/json" \
  -d '{"audioData":"dGVzdA=="}')
[ "$STATUS" = "401" ] && echo "[smoke-loadout] ✓ Invalid key correctly returns 401"

echo "[smoke-loadout] All checks passed."
```

---

### STEP 12 — Feature Flag Integration
**GATE:** `grep "ENABLE_LOADOUT" apps/web/lib/features.ts` returns a result (or equivalent feature flag file).

Add to the existing feature flag system:
```typescript
// API feature flags
ENABLE_LOADOUT: featureEnabled('ENABLE_LOADOUT'),
ENABLE_LOADOUT_PORTAL: featureEnabled('ENABLE_LOADOUT_PORTAL'),

// Web feature flags (next.config.js env)
NEXT_PUBLIC_ENABLE_LOADOUT: process.env.NEXT_PUBLIC_ENABLE_LOADOUT !== 'false',
NEXT_PUBLIC_ENABLE_LOADOUT_PORTAL: process.env.NEXT_PUBLIC_ENABLE_LOADOUT_PORTAL !== 'false',
```

Add the Loadout portal nav link to the existing sidebar/navigation — gate it on `NEXT_PUBLIC_ENABLE_LOADOUT_PORTAL`. Show it to `agencyadmin` and `rcsuperadmin` roles only.

---

## DEPLOYMENT SEQUENCE

After all steps are built and gates pass, deploy in this order:

```bash
export AWS_PROFILE=rapid-cortex
source scripts/env-api-dev.sh

bash scripts/setup-loadout-ssm.sh

export SAM_BUILD_DIR="$HOME/.rapid-cortex-sam-build"
sam build --parallel --cached
sam deploy --stack-name rapid-cortex-dev \
  --capabilities CAPABILITY_AUTO_EXPAND CAPABILITY_IAM \
  --profile rapid-cortex --region us-east-1

STAGE=dev npx tsx scripts/seed-loadout-dev.ts

bash scripts/smoke-loadout.sh
```

---

## COMPLETION CRITERIA

All of the following must pass before this build is considered done:

```bash
grep -r "LoadoutFeature"            packages/shared/src/loadout/types.ts
grep -r "LOADOUT_FEATURES"          packages/shared/src/loadout/features.ts
grep -r "monthlyBaseCents"          packages/shared/src/loadout/features.ts
grep -r "sha256"                    apps/api/src/loadout/authorizer.ts
grep -r "feature_not_licensed"      apps/api/src/loadout/authorizer.ts
grep -r "quota_exceeded"            apps/api/src/loadout/authorizer.ts
grep -r "featureLineCost"           apps/api/src/loadout/invoice-generator.ts
grep -r "ttl.*365.*7"               apps/api/src/loadout/invoice-generator.ts
grep -r "attribute_not_exists"      apps/api/src/loadout/invoice-generator.ts
grep -r "LoadoutDataStack"          infra/template.yaml
grep -r "LoadoutAppStack"           infra/template.yaml
grep -r "LoadoutSubscriptionsTable" infra/stack-data-layer-loadout.yaml
grep -r "LoadoutApiKeysTable"       infra/stack-data-layer-loadout.yaml
grep -r "LoadoutUsageTable"         infra/stack-data-layer-loadout.yaml
grep -r "LoadoutInvoicesTable"      infra/stack-data-layer-loadout.yaml
grep -r "ResultTtlInSeconds: 30"    infra/stack-app-sam-loadout.yaml
grep -r "cron(0 8 1"                infra/stack-app-sam-loadout.yaml
grep -r "x-api-key"                 infra/stack-app-sam-loadout.yaml
find apps/web/app -path "*/loadout/dashboard/page.tsx"
find apps/web/app -path "*/loadout/catalog/page.tsx"
find apps/web/app -path "*/loadout/invoices/page.tsx"
find apps/web/app -path "*/loadout/keys/page.tsx"
find apps/web/app -path "*/api/loadout/features/add/route.ts"
grep -r "ncq_live_"                 scripts/provision-loadout-key.ts
grep -r "STORE THIS KEY NOW"        scripts/provision-loadout-key.ts
```

**Final gate:** `bash scripts/smoke-loadout.sh` exits 0 against dev environment with a test API key.

---

## KNOWN GOTCHAS

- **`!ImportValue` in SAM:** when passing LoadoutDataStack outputs to LoadoutAppStack, use the exact export name string — SAM does not resolve `!Sub` inside `!ImportValue` in all CF versions. If needed, pass table names as parameters to the nested stack instead of using `!ImportValue` directly inside the Lambda env.

- **REST API vs HttpApi authorizers:** the Loadout authorizer is a `REQUEST` type on a **REST API Gateway** (not HttpApi). The Lambda receives `APIGatewayRequestAuthorizerEvent` (not a V2 event). Make sure the event type import is correct. REST API authorizer returns `APIGatewayAuthorizerResult` with a `policyDocument` — not a simple `{isAuthorized: boolean}`.

- **Cache key:** set `IdentitySource: method.request.header.x-api-key` on the authorizer. The cache is keyed on this value. If you set a different identity source the cache will not work correctly.

- **Authorizer DLQ:** Lambda authorizers do not support DLQs (they are synchronous). Only the invoice generator gets a DLQ.

- **EventBridge IAM:** the EventBridge schedule needs `lambda:InvokeFunction` permission on the invoice generator. Add this as an explicit Lambda permission resource in the SAM template.

- **SAM nested stacks require `CAPABILITY_AUTO_EXPAND`** in the deploy command. The existing `deploy.sh` already includes this — do not remove it.

- **`sam local invoke` for authorizer testing:** the authorizer event format for local testing differs from the live event. Use the `event.json` pattern from existing RCS Lambda tests if available.

---

## REFERENCE: ERROR RESPONSE FORMAT

Every API Gateway denial and application error must return this structure. Configure in API GW response templates and in Lambda handler error returns:

```json
{
  "success": false,
  "error": "feature_not_licensed",
  "message": "Your Loadout does not include the AI Transcription feature.",
  "feature": "transcription",
  "upgrade_url": "https://loadout.nexcortiq.us/catalog",
  "request_id": "req_9f3kx2m"
}
```

Error codes: `unauthorized` (401), `feature_not_licensed` (403), `quota_exceeded` (403), `unknown_endpoint` (403), `enterprise_required` (400), `service_unavailable` (503), `internal_error` (500).

---

*NexCortiQ Loadout · Apps on Demand LLC · loadout.nexcortiq.us*
*Build this system. Make it production-grade. No shortcuts.*
