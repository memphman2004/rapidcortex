# Environment readiness checklist

**Purpose:** Copy this checklist **once per physical environment** (`dev`, `staging`, `pilot`, `production`) and fill **Current value**, **Evidence**, **Owner**, and **Last verified date**.

**Important:** Do **not** promote an environment by copying **dev/demo** values into staging, pilot, or production without **explicit risk acceptance** and documentation ([DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md)).

**Single-stack programs:** If you operate **one** deployed environment, complete **one** copy of this checklist and mark staging-only items **NOT APPLICABLE**, while still satisfying **Controlled pilot** and **Production/GA** evidence requirements for that same stack before expanding scope.

**Related:** [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md), [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md), [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md).

---

## Environment metadata (fill per copy)

| Field | Value |
| --- | --- |
| **Environment name** | _dev / staging / pilot / production_ |
| **Base URL(s)** | _TBD_ |
| **Deployment stage / SAM `DeploymentStage`** | _TBD_ |
| **Git SHA / REVISION** | _TBD_ |

---

## Template — repeat sections 1–21 for each environment copy

Below, **Required value** is the *target* for that tier (see [DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md)). **Status** suggestions: `NOT STARTED` | `IN PROGRESS` | `PASS` | `NOT APPLICABLE` | `WAIVED (risk accepted)`.

### 1. Identity and access

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Cognito user pool matches this env | Pool id + region documented | _TBD_ | NOT STARTED | Console / IaC output | _TBD_ | _TBD_ |
| Every user has role + `custom:agencyId` | No orphan users | _TBD_ | NOT STARTED | Cognito export (redacted) | _TBD_ | _TBD_ |
| Break-glass / admin access documented | Named admins | _TBD_ | NOT STARTED | Runbook section | _TBD_ | _TBD_ |

### 2. Domains and CORS

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Web origin(s) explicit | HTTPS host list | _TBD_ | NOT STARTED | Hosting config | _TBD_ | _TBD_ |
| API CORS allowlist matches web origins | No unintended `*` in prod-like envs | _TBD_ | NOT STARTED | `template.yaml` / deployed config | _TBD_ | _TBD_ |
| Custom domain / TLS valid | Valid cert chain | _TBD_ | NOT STARTED | Browser / `curl -v` | _TBD_ | _TBD_ |

### 3. API upstreams

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| API Gateway base URL recorded | Execute-api or custom domain | _TBD_ | NOT STARTED | Stack outputs | _TBD_ | _TBD_ |
| Next.js BFF / proxy path verified | `NEXT_PUBLIC_AUTH_PROXY` + `API_UPSTREAM_BASE` per [INSTALLATION.md](./INSTALLATION.md) | _TBD_ | NOT STARTED | Env + network trace | _TBD_ | _TBD_ |

### 4. Cognito / auth

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| App client callback URLs include web + desktop (if used) | Match Hosted UI config | _TBD_ | NOT STARTED | Cognito console | _TBD_ | _TBD_ |
| Token lifetimes acceptable for floor | Documented | _TBD_ | NOT STARTED | App client settings | _TBD_ | _TBD_ |

### 5. Secrets

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Secrets in Secrets Manager / SSM (not repo) | ARNs documented | _TBD_ | NOT STARTED | IaC + console | _TBD_ | _TBD_ |
| Multilingual / AI ARNs present if features on | Per [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md) | _TBD_ | NOT STARTED | Integration status API | _TBD_ | _TBD_ |

### 6. Feature flags

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_*` flags match sold scope | No accidental demo flags on pilot/prod | _TBD_ | NOT STARTED | Env export (redacted) | _TBD_ | _TBD_ |
| `features.ts` / admin readiness reviewed | Registry vs reality aligned | _TBD_ | NOT STARTED | Admin readiness screenshot | _TBD_ | _TBD_ |

### 7. AI providers

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Provider keys + IAM | Non-mock for prod-like tiers unless waived | _TBD_ | NOT STARTED | Policy doc | _TBD_ | _TBD_ |
| `AI_ALLOW_MOCK_ONLY_IN_PROD` posture explicit | Matches policy ([INSTALLATION.md](./INSTALLATION.md)) | _TBD_ | NOT STARTED | Env | _TBD_ | _TBD_ |

### 8. Transcription providers

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Ingest path documented | Simulator vs live audio ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)) | _TBD_ | NOT STARTED | Operator briefing | _TBD_ | _TBD_ |

### 9. Translation providers

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Provider credentials valid | No `MULTILINGUAL_CONFIG_INVALID` | _TBD_ | NOT STARTED | `GET /api/integration/status` | _TBD_ | _TBD_ |

### 10. Text-to-voice providers

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| TTS enabled only with valid config | Matches plan | _TBD_ | NOT STARTED | Integration status + smoke | _TBD_ | _TBD_ |

### 11. Media storage

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| S3 buckets / KMS aligned to env | IaC matches deployed | _TBD_ | NOT STARTED | Stack outputs | _TBD_ | _TBD_ |
| Retention posture | Agency policy ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)) | _TBD_ | NOT STARTED | Written decision | _TBD_ | _TBD_ |

### 12. Audit logging

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Audit routes exercised | Sample events visible | _TBD_ | NOT STARTED | CloudWatch / DDB query | _TBD_ | _TBD_ |
| Sampling / review plan for pilot | Documented | _TBD_ | NOT STARTED | Runbook | _TBD_ | _TBD_ |

### 13. Monitoring and alerts

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Alarms exist for critical Lambdas | Per [infra/monitoring-and-ops.md](../infra/monitoring-and-ops.md) | _TBD_ | NOT STARTED | Console | _TBD_ | _TBD_ |
| Paging destination wired | SNS / Slack / PD | _TBD_ | NOT STARTED | Subscription screenshot | _TBD_ | _TBD_ |

### 14. WAF / edge protection

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| WAF associated or waiver documented | [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md) | _TBD_ | NOT STARTED | WAF ARN or risk memo | _TBD_ | _TBD_ |

### 15. CAD mode

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| CAD mode explicit (off / read-only / write-back) | Agency + vendor approval | _TBD_ | NOT STARTED | [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md) | _TBD_ | _TBD_ |
| Adapter credentials | Sandbox vs prod separated | _TBD_ | NOT STARTED | Secret names | _TBD_ | _TBD_ |

### 16. Telephony / CPE / radio mode

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Ingest scope matches pilot agreement | Not assumed GA ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)) | _TBD_ | NOT STARTED | SOW clause | _TBD_ | _TBD_ |

### 17. Desktop config

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| If desktop in scope: `API_BASE_URL` + Cognito match stack | Secrets.plist / appsettings | _TBD_ | NOT STARTED | Redacted config | _TBD_ | _TBD_ |
| Redirect URIs registered | Desktop + web | _TBD_ | NOT STARTED | Cognito | _TBD_ | _TBD_ |

### 18. Public site / SEO config

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` matches live host | Correct canonical | _TBD_ | NOT STARTED | Fetched `<link rel="canonical">` | _TBD_ | _TBD_ |
| `/sitemap.xml` + `/robots.txt` verified | 200 + sensible content | _TBD_ | NOT STARTED | `curl` | _TBD_ | _TBD_ |

### 19. Smoke tests

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| `./scripts/post-deploy-smoke.sh` green | Latest log | _TBD_ | NOT STARTED | [PILOT_READINESS_RUN_RESULTS.md](./PILOT_READINESS_RUN_RESULTS.md) | _TBD_ | _TBD_ |
| `GET /api/health` | 200 from public/client path | _TBD_ | NOT STARTED | curl | _TBD_ | _TBD_ |

### 20. Rollback

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Previous release artifact retained | Tag + deploy notes | _TBD_ | NOT STARTED | CI / S3 | _TBD_ | _TBD_ |
| Rollback procedure tested | Documented time to recover | _TBD_ | NOT STARTED | Drill log | _TBD_ | _TBD_ |

### 21. Owner / signoff

| Gate | Required value | Current value | Status | Evidence | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| Engineering signoff | Name + date | _TBD_ | NOT STARTED | Email / ticket | _TBD_ | _TBD_ |
| Security signoff (if required) | Name + date | _TBD_ | NOT STARTED | Email | _TBD_ | _TBD_ |
| Agency acceptance (pilot+) | Name + date | _TBD_ | NOT STARTED | Signed addendum | _TBD_ | _TBD_ |

---

## Quick copy — environment name header only

Duplicate everything **below** this line when filing `dev`, `staging`, `pilot`, and `production` separately.

---

### Environment: `___` (fill)

_(Paste sections 1–21 from the template above.)_
