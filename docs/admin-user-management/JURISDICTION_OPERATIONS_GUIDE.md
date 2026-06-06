# Jurisdiction operations guide — install, setup, maintenance & troubleshooting

**Audience:** **County, city, and municipal** communications centers — **agency IT**, **911 / ECC administrators**, **supervisors**, and **training leads** responsible for Rapid Cortex **after** your environment is live.  
**Scope:** What happens **on your networks and screens**: access, first-time setup, day‑2 care, and fault finding. **Not** a substitute for procurement, legal, or CAD vendor contracts.

**Canonical product scope:** [MVP_SCOPE.md](./MVP_SCOPE.md) · **What we do not promise:** [NON_GOALS.md](./NON_GOALS.md) · **Honest limits:** [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

---

## 1. Roles: who does what

| Responsibility | Typical role | Rapid Cortex doc |
|------------------|--------------|------------------|
| Browser access, URLs, first login, MFA | **Agency IT** + identity admin | This guide §2–3, [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md) |
| User accounts, roles, agency id on users | **Agency admin** (in-app + Cognito) | [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md), [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) |
| Dispatcher / supervisor training | **Training lead** | [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md), [USER_GUIDE.md](./USER_GUIDE.md) |
| AWS stack, Lambda, secrets, CORS, domains | **RC or hosting DevOps** (or your MSP) | [INSTALLATION.md](./INSTALLATION.md), [AWS_SETUP.md](./AWS_SETUP.md) |
| Pilot governance, escalations to RC | **Agency champion** + RC pilot lead | [SUPPORT_MODEL.md](./SUPPORT_MODEL.md), [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md) |

Rapid Cortex is **assistive** software in a **browser tab**. It does **not** replace CAD, CPE, radio, or logging as the system of record.

---

## 2. Install — getting Rapid Cortex on your screens

There is **nothing to compile** on agency workstations. “Install” means **secure access** to the web app your operator already hosts (or Rapid Cortex hosts for you).

### 2.1 Before anyone logs in

1. **Confirm the environment** you were given (e.g. pilot vs production) — **do not mix** URLs or accounts between them.  
2. **Use a supported browser:** current **Chrome** or **Edge** (Chromium), **HTTPS only**.  
3. **Bookmark the correct URL** — pattern:

   `https://<your-site>/<jurisdiction-slug>/login`

   Examples of slugs: `columbus`, `erie-county`. The slug is for **routing and branding**; **tenant security** comes from **Cognito** claims (`custom:agencyId`, `custom:role`), not from guessing the slug ([USER_GUIDE.md](./USER_GUIDE.md)).

4. **Network:** allow HTTPS to your app host and (if applicable) the API host your IT documents. If the product uses the **auth proxy** (`NEXT_PUBLIC_AUTH_PROXY=1`), the browser talks to your **web origin** only; IT still must allow that origin to reach the API upstream (server-side).

### 2.2 First sign-in (every user)

1. Open **Login** at your agency URL.  
2. Sign in with **email + password** issued by your admin (Amazon **Cognito** in standard pilots).  
3. Complete **password change** or **MFA** if your pool requires it — do **not** disable MFA as a workaround without security sign-off ([TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)).  
4. Dispatchers land on **`/dashboard`**; admins use **`/admin`** routes as assigned.

### 2.3 Workstations and attachments

- Prefer **dedicated ECC machines** or controlled VDI profiles per your policy.  
- If **audio / multilingual** voice upload is in scope, confirm **microphone / browser permissions** with IT; see [MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md).

---

## 3. Setup — agency tasks before go‑live traffic

Use this as a **sequenced checklist**. Deeper detail links out so this file stays maintainable.

| Step | Action | Done when |
|------|--------|-----------|
| 1 | **Contacts** — Fill [OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md) (agency + RC). | Names, phones, after-hours. |
| 2 | **Admin accounts** — At least one `admin` user with correct `custom:agencyId` ([USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)). | Admin can sign in. |
| 3 | **Pilot hub** — Open **`/{slug}/admin/pilot`**, walk milestones and doc links ([ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md)). | Agency acknowledges checklists. |
| 4 | **Configuration / Integrations** — **`/{slug}/admin/configuration`** and **`/{slug}/admin/integrations`**. | Integration summary acceptable for pilot; `multilingualIssueCount` understood ([RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md)). |
| 5 | **Provision users** — Dispatchers, supervisors; roles per [ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md). | Each role smoke‑tested. |
| 6 | **Training** — [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md), [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md); use **`/demo`** only where policy allows ([NON_GOALS.md](./NON_GOALS.md) §5). | Supervisors sign off readiness. |
| 7 | **Smoke test** — Relevant rows of [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) (health, auth, incidents, transcript, optional voice). | Green or documented exceptions. |

**Agency IT parallel track** (often led by RC or your MSP): Cognito app client **callback URLs**, cookie domain, and **CORS** alignment with your **www** host — [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md).

---

## 4. Setup — when your IT also operates the AWS stack

If your county/municipality **self‑hosts** or co‑manages AWS (less common than RC‑hosted SaaS):

1. Follow **[INSTALLATION.md](./INSTALLATION.md)** (clone, build, env) and **[AWS_SETUP.md](./AWS_SETUP.md)** (SAM deploy, smoke, stack outputs).  
2. Map domains and certificates per **[infra/README.md](../infra/README.md)**.  
3. Wire the **web app** env from stack outputs (`./scripts/print-stack-outputs-for-web.sh` or equivalent).  
4. Keep **secrets** in **Secrets Manager** (not email); multilingual and AI keys per [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md) and [AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md).

---

## 5. Maintenance — recurring work

| Cadence | Task | Owner |
|---------|------|--------|
| **Weekly** | Glance **Admin → Integrations**; spot‑check **Audit** for unusual error rates. | Agency admin + IT |
| **Monthly** | Review user roster (leavers, role changes); confirm no accidental **`NEXT_PUBLIC_OFFLINE_DEMO_MODE`** on pilot hosts ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)). | Admin + IT |
| **Per release** | Apply **web** env updates from RC release notes; note Lambda/API updates if you manage the stack. | IT / DevOps |
| **Secret rotation** | Azure / Google / API keys per runbook — never paste secrets into tickets ([RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md), [SUPPORT_MODEL.md](./SUPPORT_MODEL.md)). | IT |
| **Governance** | Short retro using [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md); update [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) when new boundaries are learned. | Agency champion |

**What agencies do *not* maintain in the pilot UI:** there is **no** in‑app editor for Lambda AI keys, IAM, or Dynamo retention enforcement — those are **platform** concerns ([CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md)).

---

## 6. Troubleshooting — fast path

Collect **once** before escalating: full **URL**, **UTC time**, **role**, **incident id** (if any), screenshot of the **connection** / status strip, and any API **`requestId`** / **`errorCode`** shown in the UI ([TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)).

| Symptom | First checks | Then |
|---------|--------------|------|
| **Cannot log in** | Correct URL slug; pool MFA; password expiry | [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md), agency IdP |
| **“API offline” / empty queue** | Connections strip; not on offline demo mode | [INSTALLATION.md](./INSTALLATION.md), [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) |
| **403 on admin** | User missing `admin` role | [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md) |
| **503 on audio / voice** | Integration panel; `MULTILINGUAL_CONFIG_INVALID` body | [RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md) |
| **AI analyze fails** | Copy `requestId`; transcript changed? | [RUNBOOK.md](./RUNBOOK.md) |

**Continue 911 operations without Rapid Cortex** if the co‑pilot is unavailable — the product is not the system of record ([NON_GOALS.md](./NON_GOALS.md)).

**Escalation:** [ESCALATION_PATHS.md](./ESCALATION_PATHS.md) and [SUPPORT_MODEL.md](./SUPPORT_MODEL.md). **Security / breach:** [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).

---

## 7. Related documents (deep dives)

| Topic | Document |
|-------|----------|
| Day‑to‑day screens | [USER_GUIDE.md](./USER_GUIDE.md), [COMMON_TASKS.md](./COMMON_TASKS.md) |
| Admin workflows | [ADMIN_GUIDE.md](./ADMIN_GUIDE.md), [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) |
| Full onboarding story | [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md), [GTM_PACKAGE.md](../go-to-market-sales/GTM_PACKAGE.md) |
| CAD / ECC record system integration | [RapidCortex-CAD-Integration-Guide-1.0.pdf](./RapidCortex-CAD-Integration-Guide-1.0.pdf) · [cad-integration checklist (Markdown)](../cad-integrations/cad-integration-checklist-master.md) |
| Platform / on‑call | [RUNBOOK.md](./RUNBOOK.md), [MONITORING_AND_OPS.md](../infra/monitoring-and-ops.md) |

---

## Appendix A — Recommended **agency download package** (ZIP / printed binder)

When you ship documentation to each jurisdiction, bundle **this file** as the cover guide, plus the paths below from the same `docs/` tree (or hosted equivalent). Adjust for your program (e.g. omit internal-only links if you distribute PDFs publicly).

**Machine-readable manifest (canonical file list for ZIPs):** [`demo/customer-program-documentation-bundle.json`](../../demo/customer-program-documentation-bundle.json). From a repository checkout, run **`npm run package:customer-docs`** to write **`dist/rapid-cortex-customer-program-docs-<YYYYMMDD>.zip`** (includes the manifest, the **Complete Operations Manual** HTML, and a short `README.txt` at the archive root). When the web app is deployed, the same manual is served as a static file at **`/docs/rapidcortex-complete-manual.html`** (e.g. `https://www.rapidcortex.us/docs/rapidcortex-complete-manual.html`).

| Include | Why |
|---------|-----|
| **This file** — `JURISDICTION_OPERATIONS_GUIDE.md` | Single entry point for IT + admins. |
| **Complete Operations Manual** (`apps/web/public/docs/rapidcortex-complete-manual.html`) | Single-file, printable-style manual; included in the customer ZIP and on the live site at `/docs/rapidcortex-complete-manual.html`. |
| [USER_GUIDE.md](./USER_GUIDE.md) | Operators on the floor. |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) · [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) · [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md) | Admins. |
| [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md) | IT identity integration. |
| [RapidCortex-CAD-Integration-Guide-1.0.pdf](./RapidCortex-CAD-Integration-Guide-1.0.pdf) | **CAD inbound integration** — webhooks, vendor IT, agency firewall / URL checklist (v1.0). |
| [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) · [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) · [ESCALATION_PATHS.md](./ESCALATION_PATHS.md) | Break/fix and routing. |
| [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) · [NON_GOALS.md](./NON_GOALS.md) | Truth in advertising for leadership. |
| [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md) · [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md) | Training org. |
| [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md) · [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) | Checklists. |
| [RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md) | If voice / multilingual is live. |
| [INSTALLATION.md](./INSTALLATION.md) · [AWS_SETUP.md](./AWS_SETUP.md) | **Only if** agency IT operates the stack. |

**Internal RC / SE-only** (do not leave in unattended public folders): [FAQ_INTERNAL.md](./FAQ_INTERNAL.md), [PROMISE_CONTROL.md](./PROMISE_CONTROL.md).

---

## Appendix B — Glossary (short)

| Term | Meaning |
|------|---------|
| **Jurisdiction slug** | URL segment (`/columbus/…`) for your agency’s links. |
| **`custom:agencyId`** | Cognito claim tying users to **one** tenant; enforced by the API. |
| **`custom:role`** | `dispatcher` · `supervisor` · `admin` · etc.; controls RBAC. |
| **Auth proxy** | Browser calls your Next.js host; server forwards to API with **httpOnly** cookies (`NEXT_PUBLIC_AUTH_PROXY=1`). |

---

*Revision tip: when your pilot changes (e.g. new voice languages), update the linked checklists and re‑export the bundle.*
