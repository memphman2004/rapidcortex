# Pilot deploy working plan

**Last updated:** 2026-06-28  
**Audience:** Engineering (deploy sequence) + program/business (scope boundaries)  
**Live stack:** `rapid-cortex-dev` serves production hostnames (`api.rapidcortex.us`, `app.rapidcortex.us`, …). Treat “prod deploy” as **hostname prod / stack name dev** until a separate `rapid-cortex-prod` recovery is explicitly scoped (P3 — not this push).

---

## 1. Two conversations — do not merge

| Conversation | Question | Owner | This doc |
| --- | --- | --- | --- |
| **A — Pilot floor** | What do we deploy/fix to reach a **controlled pilot** on the live hostname? | Engineering | Sections 2, 4, 5 |
| **B — Full product** | What does “all features fully functioning” actually require? | Product + legal + integrations | **Section 3 only** |

Deploy scripts answer **A**. They never answer **B**. Present them separately to stakeholders.

---

## 2. Recommended deploy sequence (engineering)

Run **one deploy at a time**. Web packaging and SAM lean deploy both mutate `apps/api` vendor paths — serialize (see `scripts/lib/api-vendor-lock.sh`).

| Step | Action | Gate / evidence | Status |
| ---: | --- | --- | --- |
| 1 | IAM managed policies on `rapid-cortex-deploy` (**core + web**, see `apply-sam-deploy-managed-policies.sh`) | ECR/CodeBuild/SSM + **`DetectStackDrift` + `DetectStackResourceDrift`** | **PASS** after split apply |
| 2 | Confirm **AppSam4 idle** (`UPDATE_COMPLETE`, no in-flight deploy) | CFN stack status + no active CodeBuild/SAM on sam4 | **PASS** |
| **2b** | **Stack-1 drift check** on `rapid-cortex-dev` **before** stack-1 code deploy | `detect-stack-drift` + `describe-stack-drift-detection-status`; requires **`DetectStackDrift` + `DetectStackResourceDrift`** on stack ARN | **NOT RUN** — live policy missing `DetectStackResourceDrift` (see §4) |
| 3 | Stack-1 deploy: `accessOverrideService.ts` (rcsuperadmin platform-wide overrides) | Lean deploy stack 1 only; wait **COMPLETE + idle** before step 5 | **NOT STARTED** |
| 4 | **Ring routing → `api4.rapidcortex.us`** (decision locked — see §5) | AppSam4 redeploy with `Route53HostedZoneId` + managed ACM; DNS resolves; oauth start 302 on custom domain | **NOT STARTED** — `api4.rapidcortex.us` does not resolve today |
| 5 | Web prod deploy (`RC_LOG_MIDDLEWARE_RSC=1`, `deploy-web-no-docker.sh prod`) | ECS stable, health 200, host routing | **PASS** (2026-06-28) — smoke failed on `/developers/api` copy only; app health **200** |
| 6 | Re-run Ring gate: deploy → 302 → isolation test on **`https://api4.rapidcortex.us`** | `ring-citizen-owner-isolation-test.ts` **5/5** | **PARTIAL** — 302 + 5/5 on execute-api URL only until step 4 |
| 7 | Host routing verify (if skipped due to smoke) | `verify-host-routing.sh` | **NOT RUN** |
| 8 | Marketing / copy fixes as needed | Separate from API deploys | As needed |

**Serialization rule:** Step 5 must not start until step 3 is **fully complete and idle**, not “probably done by then.” Same for any parallel SAM work.

---

## 3. What deploys fix vs what deploys never fix

### Deploys can reach (pilot floor)

- Ship Lambda/API/web container code that exists in repo
- Wire env vars, BFF routes, feature flags, IAM for deploy user
- Stand up stack-4 public Ring OAuth + citizen owner table (AppSam4)
- ECS/CloudFront rollout for `app.rapidcortex.us`
- Drift remediation **when** drift is detected and change is scoped

### Deploys will never fix (explicit non-goals for deploy checklist)

| Area | Why not deploy | Owner |
| --- | --- | --- |
| **SOW / pilot agreement / DPA** | Legal/commercial authority to run live agency work | **Business / legal** — PLT-001–004 ([NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md)) |
| **Security review sign-off** | Formal control attestation | Security / program |
| **CAD vendor adapters (live read)** | Per-vendor integration work + agency credentials | Integrations — scaffolding only today |
| **CAD write-back** | Intentionally fail-closed; separate addendum | Product + legal + agency |
| **Transit vertical** | No UI/routes | Product |
| **Desktop signing / notarization / update channel** | Release engineering + Apple/Microsoft programs | Desktop |
| **Full API surface E2E** | Many routes still stub/501 by design | Product scope |
| **GA / multi-customer “fully functioning”** | Requires closing most PLT + GA rows | Program |

**Business-side thread (parallel to engineering):** Even a perfect run through the 8-step sequence does **not** produce something **sellable beyond pilot**. Governance gaps (SOW, DPA, security review) need a named owner the same way IAM and CAD have owners here.

---

## 4. Verified gates (evidence, not assumptions)

### Ring citizen OAuth — AppSam4

| Check | Result | When |
| --- | --- | --- |
| AppSam4 deploy | `UPDATE_COMPLETE` | 2026-06-28 |
| Public oauth start → 302 | `GET …/api/public/ring/oauth/start?agencyId=test-agency` → 302 to Ring authorize URL | execute-api + stack-4 |
| **`ring-citizen-owner-isolation-test.ts`** | **5/5 PASS** | **Re-run 2026-06-28** against `API_URL_4=https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com`, `API_URL=https://api.rapidcortex.us` |

Command to re-verify after api4 DNS:

```bash
API_URL_4=https://api4.rapidcortex.us API_URL=https://api.rapidcortex.us AGENCY_A_ID=test-agency \
  npx tsx scripts/ring-citizen-owner-isolation-test.ts
```

### Web prod deploy

| Check | Result |
| --- | --- |
| CodeBuild | SUCCEEDED (~320s), 66 env overrides incl. `RC_LOG_MIDDLEWARE_RSC=1` |
| ECS | Stable 2/2 on `rapid-cortex-v2-web-prod` |
| Live health | `https://app.rapidcortex.us/api/health/web` → **200** |
| Script exit | **1** — smoke content mismatch on `/developers/api` (non-blocking for rollout) |

### CAD — one-line answer (direct)

**Confirmed: zero agencies on the live stack have any active CAD integration configured; therefore no dispatcher on production traffic can receive live or mocked CAD poll data from stack 1 today.**

Evidence (2026-06-28, account `158961537080`, stack `rapid-cortex-dev`):

- DynamoDB `rapid-cortex-cad-integrations-dev`: **0 rows** (scan count 0)
- `CadApiPollerFunction` env: `CAD_POLLER_MOCK=0` (mock mode off, but poller finds **0** active `api_poll` integrations)
- Poller behavior when mock were on: log-only, no SNS ingress (see `cadApiPoller.ts`)

**Implication:** The worst-case scenario (dispatcher trusting fake CAD during a real incident) **cannot happen today** because there is no live CAD path — not because mock is safely configured, but because **nothing is connected**.

**Still decide (hygiene, not urgency):** Keep `CAD_POLLER_MOCK=0` in template; do not enable mock on shared stacks without an explicit test-agency-only gate.

### Stack-1 drift — pre-deploy insurance

**Not yet run** via CloudFormation drift API:

- `rapid-cortex-deploy` → `AccessDenied` on **`DetectStackResourceDrift`** when calling `detect-stack-drift` (needs both drift actions on `rapid-cortex-*` stack ARNs; read side in `CfnDiscovery` is correct)

**Quick inventory (2026-06-28):**

- `AppSamStackV2`: **no** `Ring*` Lambda resources in CFN (RingConnect orphans are `AppSam4S-*`, stack 4 concern)
- Does **not** replace full drift detection before stack-1 deploy

**Action:** Run `ADMIN_AWS_PROFILE=admin ./scripts/apply-sam-deploy-managed-policies.sh`, then `aws cloudformation detect-stack-drift --stack-name rapid-cortex-dev` as deploy user.

---

## 5. Ring routing — decision locked: **api4 DNS**

**Rejected for this program:**

| Option | Why not |
| --- | --- |
| Stack-1 proxy | Adds cross-stack coupling to API GW with its own unresolved drift/orphan history; wrong moment to touch |
| BFF-only / raw execute-api URL | Acceptable hours-only stopgap; not durable for public marketing OAuth links |

**Chosen:** **`https://api4.rapidcortex.us`** → AppSam4 HTTP API only.

- Infra already sets `ApiSubdomainPrefix: api4` on AppSam4 nested stack (`infra/template.yaml`)
- Custom domain **not live yet** — stack outputs only `HttpApiUrl` (execute-api); no `ApiCustomDomainUrl`
- Enable via AppSam4 parameters: `Route53HostedZoneId` (+ optional imported cert) → managed ACM + Route53 alias (template conditions `HasManagedApiCert` / `HasApiCustomDomainCert`)

After deploy: update marketing/connect links and `API_URL_4` / BFF upstream env to `https://api4.rapidcortex.us`.

---

## 6. P3 — out of this push

| Item | Track | Do not fold into “this week” |
| --- | --- | --- |
| `rapid-cortex-prod` stack recovery (`ROLLBACK_COMPLETE`) | Infra hygiene backlog | Yes |
| Full GA readiness | [FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md) + [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md) | Yes |

---

## 7. Related docs

- [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md) — tier blockers (PLT/GA governance rows)
- [FEATURE_READINESS_MATRIX.md](./FEATURE_READINESS_MATRIX.md) — honest feature vs stub map
- [PILOT_STATUS_ASSESSMENT.md](./PILOT_STATUS_ASSESSMENT.md) — YELLOW conditional pilot framing
- `scripts/audit-appsam4-ring-drift.sh` — AppSam4 resource audit (+ `--detect-drift` with admin)
- `scripts/ring-citizen-owner-isolation-test.ts` — Ring citizen isolation gate
