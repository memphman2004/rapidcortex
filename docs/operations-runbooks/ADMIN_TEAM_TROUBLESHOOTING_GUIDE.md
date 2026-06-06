# Rapid Cortex admin team troubleshooting guide

## Purpose

This guide is the **internal** operational playbook for the Rapid Cortex admin team to diagnose, troubleshoot, document, resolve, and escalate customer issues. It is written for administrators, support managers, trainers, implementation teams, and technical leads supporting customer agencies using Rapid Cortex.

Rapid Cortex supports mission-critical emergency communications workflows. Because customers may be public-safety agencies, municipalities, counties, cities, and other emergency response organizations, every issue should be handled with urgency, clarity, consistency, and complete documentation.

**Related (canonical product docs):** [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) (evidence checklist, pilot-specific symptoms) · [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) · [ESCALATION_PATHS.md](./ESCALATION_PATHS.md) · [RUNBOOK.md](./RUNBOOK.md) · [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) · [FAQ_INTERNAL.md](./FAQ_INTERNAL.md).

---

## Product alignment (this repository)

The **standard pilot** ships the **web application** (`apps/web`, Next.js) and **API** (`apps/api`). This monorepo does **not** include a separate Rapid Cortex **desktop executable**. Default intake and triage to **supported browser + OS** (Chrome or Edge, permissions, extensions, VPN, proxy, workstation audio).

Where this guide refers to a **desktop app** or **web vs desktop sync**, treat that as **(optional program delivery)** only if your contract or release train includes a packaged desktop client. Otherwise interpret “desktop” symptoms as **another browser profile**, **VDI session**, **second workstation**, or **PWA-style install** of the same web app—and use the same isolation steps.

There is **no** in-product remote control of customer machines; use approved external screen-share or on-site IT per agency policy ([JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md)).

---

## 1. Core support principles

### 1.1 Mission-critical mindset

Rapid Cortex is not a casual consumer app. Classify impact as one of:

- **Critical operational impact**
- **High business impact**
- **Moderate workflow impact**
- **Low impact / informational**

### 1.2 First priorities in every case

1. Is the issue happening now or did it happen earlier?
2. Is live emergency workflow currently impacted?
3. Is the issue affecting one user, one workstation, one site, or the entire agency?
4. Is there a workaround available?
5. Is the issue related to access, audio, AI response quality, routing, integrations, sync, deployment, or data?
6. Does engineering, infrastructure, or implementation need to be engaged immediately?

### 1.3 Golden rules for admin staff

- Never guess when a fact can be verified.
- Never tell a customer an issue is resolved until testing confirms it.
- Never blame the customer.
- Never alter production settings without recording what changed.
- Never close a ticket without documenting the root cause, corrective action, and prevention step.
- Always preserve logs, timestamps, screenshots, affected user names, device details, and reproduction steps.
- Always assume the customer may need status updates during the investigation.

Align severity vocabulary with pilot docs: **SEV-1 / SEV-2 / SEV-3** in [ESCALATION_PATHS.md](./ESCALATION_PATHS.md) and [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) map to the levels below; use **one** scale per ticket so leadership can roll up metrics.

---

## 2. Support team roles

| Role | Responsibility |
|------|----------------|
| **Admin support representative** | Intake, severity, facts, standard troubleshooting, approved fixes, escalation, customer comms |
| **Support lead / operations manager** | Major incidents, prioritization, emergency workarounds, cadence, RCA review |
| **Technical / implementation specialist** | Workstation OS/browser, agency env mismatch, network/VPN/firewall, microphone/headset, integration troubleshooting |
| **Engineering / DevOps / infrastructure** | Platform bugs, API failures, AI pipeline, auth defects, persistence, regional incidents |
| **Training / customer success** | Usage confusion, workflow coaching, SOP alignment, retraining when the system is behaving as designed |

---

## 3. Incident severity levels

### 3.1 Severity 1 — Critical

Use when:

- An agency cannot use Rapid Cortex for live operations.
- Core workflow (e.g. queue, incident handling, critical admin path) is blocked for many users or the whole center.
- Audio capture or transcription is completely unavailable during active use (when voice is in scope).
- Authentication is broken for a broad population (not one mistyped password).
- Suspected data loss or security exposure in an operational area.

**Response expectations:** Immediate acknowledgment; support lead + technical owner; incident log; frequent updates; start triage before the narrative is perfect.

### 3.2 Severity 2 — High

Major feature unavailable with workaround; several users impacted; AI outputs broadly degraded; team- or site-scale login failures; significant latency in transcript or analysis when that blocks workflow; intermittent audio affecting operations.

### 3.3 Severity 3 — Medium

One user or workstation; non-critical module; repeatable but not blocking; configuration mismatch limiting some tasks.

### 3.4 Severity 4 — Low

Informational; cosmetic; guidance/retraining; minor annoyance without operational impact.

---

## 4. Intake checklist for every customer issue

### 4.1 Customer identity

- Agency name, site/center, department/unit
- Primary contact, callback, email, time zone

### 4.2 User and device details

- Affected user(s), role(s)
- **Pilot standard:** Chromium-class **browser** and version (Chrome or Edge); OS version
- **Optional:** “Desktop client” only if your program ships one—not the core open-source web stack
- Device hostname if available
- Headset or audio device type when voice is in scope

### 4.3 Issue details

- Exact description; start time; ongoing vs intermittent
- Exact error text; steps immediately before failure
- Scope (one vs many); reproducibility
- Triggers: update, setting change, network change, hardware swap, deployment window

### 4.4 Evidence to request

- Screenshot or short recording
- Error text copied exactly
- **UTC** timestamp (correlate with CloudWatch)
- **Full URL** path (jurisdiction slug + route)
- Incident id if applicable
- API **`requestId`**, **`errorCode`**, **`error`** when shown ([TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md))
- Screenshot of **Connections** / API live strip when relevant
- Audio or transcript sample if relevant (handle per privacy policy)

### 4.5 Immediate classification questions

- Is live service impacted right now?
- Another workstation or browser profile?
- Isolated to headset, station, room, or whole agency?
- Started after install, update, or network change?

---

## 5. Standard troubleshooting workflow

1. **Confirm scope** — user, workstation, network, site, role, environment, or system-wide.
2. **Confirm reproducibility** — exact steps; every time vs intermittent; another device/user.
3. **Check known conditions** — incidents, maintenance, releases, config changes, known bugs, certs/credentials.
4. **Run category-specific steps** — Section 6 + [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md).
5. **Test after each change** — failed action works; logs clean; side effects checked.
6. **Document everything** — symptoms, scope, steps, outcomes, escalation, follow-ups.

---

## 6. Issue categories and detailed troubleshooting

Use this section with the **product-specific** checklist in [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) (e.g. offline demo mode, integration summary, multilingual strict mode).

### 6A. Login and access

**Symptoms:** Cannot sign in, invalid credentials, immediate logout, wrong dashboard/permissions, MFA failures, reset not received, disabled/pending appearance.

**Common causes:** Wrong email; locked/disabled user; wrong `custom:role` or `custom:agencyId` on JWT; pool/app-client mismatch; token/session issues; browser cache; clock skew.

**Steps:** Confirm one vs many users; verify email; check Cognito status and attributes ([USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md), [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)); sign out/in; private window; if widespread, treat as **Severity 1** auth incident.

**Escalate when:** Pool or app client miswired for this host; persistent 403 with correct claims; unexplained multi-user lockout.

### 6B. Optional desktop client (if your program ships one)

**Symptoms:** App will not launch, crash on splash, OS security blocks binary.

**Note:** Skip this subsection for **web-only** pilots; use **6C** + workstation checks instead.

**Steps:** OS version; build version; reboot; official package; AV/endpoint interference; another user on same machine; reinstall from approved build; capture crash logs if available.

**Escalate when:** Correlated multi-site failure after a release; reinstall does not fix.

### 6C. Web app not loading or behaving incorrectly

**Symptoms:** Blank screen, spinner never completes, partial load, buttons no-op, stale data.

**Steps:** Supported browser/version; second browser; incognito; disable extensions; sign out/in; one vs all users; VPN/proxy; compare another network; capture route + screenshot; console errors if customer IT allows.

**Escalate when:** Multi-agency pattern; API strip shows failures; regression after deploy.

### 6D. Audio / microphone / headset

**Symptoms:** No input, flat meter, wrong device, dropouts.

**Steps:** OS input selection and privacy; physical mute; test in another app; different headset; reboot; competing apps holding device; multilingual permissions ([MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md), [RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md)).

**Escalate when:** Audio reaches the browser but pipeline never starts; agency-wide after release.

### 6E. Transcription

**Symptoms:** Missing, late, wrong language, poor quality.

**Steps:** Confirm audio path first; timestamp + example; language configuration; network stability; provider health; `requestId` for engineering ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)).

**Escalate when:** Service entirely unavailable; systematic language detection failure after release.

### 6F. AI guidance / quality

**Symptoms:** No guidance, delay, irrelevant output, incomplete summary.

**Steps:** Classify absence vs latency vs quality; confirm transcript/context; timestamp + example; one vs many; recent prompt/config changes; route examples with `requestId` ([RUNBOOK.md](./RUNBOOK.md)).

**Escalate when:** Cross-agency loss of guidance; unsafe or policy-violating output pattern; immediate post-release regression.

### 6G. Call / session / workflow issues

**Symptoms:** Session does not progress, frozen UI, events feel out of order, status not updating.

**Steps:** Session/incident id; expected vs actual; reproducibility; another role or station; timestamps; distinguish UI bug vs API sequencing ([CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md)).

**Escalate when:** Active operations at risk; wrong persistence across users.

### 6H. Stale or inconsistent views (web-only and optional desktop)

**Symptoms:** Two views disagree; action “missing” after navigation.

**Note:** For **web-only**, inconsistent views are often **multiple tabs**, **stale client cache**, or **failed API write**—hard refresh, second browser, re-login, then verify server-side record before assuming a “sync layer.”

**Steps:** Identify which view is authoritative (server); timestamps; refresh; re-login if safe; compare another user; verify write in API/audit.

**Escalate when:** Persistence missing in backend; multi-user divergent state after controlled refresh.

### 6I. Integrations

**Symptoms:** Missing import/export; mapping delay; credential errors.

**Steps:** Which connector; inbound vs outbound; last success; cert/credential/network change; allowlists; vendor status ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).

**Escalate when:** Production integration fully stopped with valid credentials; multi-tenant pattern.

### 6J. Performance / slowness

**Symptoms:** Slow login, dashboard, transcript lag, save delays.

**Steps:** Quantify delay; local vs broad; time-of-day; workstation resources; second machine; service health and deploy history.

**Escalate when:** Core workflow exceeds agreed threshold broadly; correlates with backend incident.

### 6K. Permissions / roles / admin console

**Symptoms:** Missing admin controls; unexpected 403/401; role change not effective.

**Steps:** Expected vs actual Cognito attributes; re-login; tenant scope; compare peer user; distinguish UI vs API denial ([ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md), [API_SURFACE.md](./API_SURFACE.md)).

**Escalate when:** Cross-tenant data visible; correct claims still wrong access.

### 6L. Offline / connectivity / network

**Symptoms:** Intermittent disconnects, reconnect loops, actions fail on network change.

**Steps:** Wired vs Wi‑Fi; VPN; site-only pattern; firewall/proxy; whether REST works while “live” UI feels stuck.

**Escalate when:** Site-wide instability; reconnect logic fails on stable network post-release.

---

## 7. Major incident process

**Invoke when:** Severity 1; multiple customers; suspected data loss or security issue; widespread post-release failure.

**Admin actions:** Open incident record; first report time; impacted customers/modules/environments; notify support lead and technical owner; avoid fragmented duplicate threads; consistent customer updates; log every change; confirm resolution with testing; post-incident review.

### Customer update template

- What happened; what is affected; what is **not** affected if known
- What we are doing now; workaround; next update time or trigger

---

## 8. Escalation matrix

| Escalate to | When |
|-------------|------|
| **Support lead** | High/critical ambiguity; executive visibility; pattern across tickets; risky workaround |
| **Technical / implementation specialist** | Workstation, network, permissions, integration setup on customer side |
| **Engineering / DevOps** | Reproducible product defect; API/service regression; auth/persistence/AI pipeline broken |
| **Security / compliance** | Suspected unauthorized access, cross-agency visibility, credential misuse, audit concerns |
| **Training / customer success** | System correct but workflow misunderstood; adoption gap |

---

## 9. Documentation standards for every ticket

Include: ticket id; opened (UTC); agency; contact; severity; affected users/locations; symptoms; repro steps; operational impact; attachments; logs/timestamps; actions; status; resolution or escalation path; root cause; preventive action; closed (UTC).

**Good vs bad:** Replace “app broken” with agency, time zone + UTC, role, surface (browser/build), expected vs actual, scope, steps tried, and **`requestId`** when available.

---

## 10. Troubleshooting scripts for admin staff

1. **Opening:** “Thank you for contacting Rapid Cortex support. I’m going to document the issue and work through this with you. First, is this affecting live operations right now, how many users, and what exact error or behavior do you see?”
2. **Clarification:** “Walk me through the exact steps right before the problem and the exact time it occurred (your local time is fine—we’ll convert to UTC for logs).”
3. **Scope:** “Is this just you, this workstation, multiple users in your center, or everyone at your site?”
4. **Testing:** “We’ll change one thing at a time; after each step, try the same action again and tell me if anything changes.”
5. **Escalation:** “I’ve completed first-line steps and I’m escalating with the symptoms, timestamps, and environment we captured so the technical team can move faster.”
6. **Resolution:** “We’ve confirmed resolution. Before we close, please verify the workflow on your side once more; we’ll document root cause and prevention.”

---

## 11. Preventive support best practices

- **Release readiness:** login per role; microphone permissions where voice is in scope; transcription start; AI path smoke; reconnect after brief offline; integration summary clean on **Admin → Configuration** ([PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)).
- **Customer readiness:** supported browsers/OS; allowlists; headset standards; role mapping; escalation contacts ([OPS_CONTACT_MATRIX.md](./OPS_CONTACT_MATRIX.md)).
- **Knowledge base:** known errors; release notes; recurring issues; approved workarounds.
- **Trend review:** weekly scan for auth, audio, performance, integration, training-gap patterns.

---

## 12. Customer issue playbooks (short)

| Scenario | First moves |
|----------|-------------|
| **A. One user cannot log in** | Email; Cognito status/attributes; roles; private window; password/MFA path; escalate if correct config still fails |
| **B. No transcription (voice in scope)** | OS + browser mic permission; device selection; test in other app; other workstation; escalate if audio present but pipeline dead |
| **C. Entire center “slow”** | Web vs isolated paths; timeframe; incidents/releases; network; escalate as performance incident if broad |
| **D. Wrong permissions** | Claims vs expected role; re-login; peer user compare; escalate if tenant bleed or wrong RBAC with correct claims |
| **E. Inconsistent views** | Refresh + second browser; verify server record/audit; escalate if persistence broken |

---

## 13. Root cause categories for closure

User error / training gap · local device configuration · hardware failure · OS permission · browser/session · local network · customer policy restriction · authentication service · application defect · release regression · integration credential/config · third-party degradation · unknown pending engineering.

---

## 14. Post-incident review (significant issues)

Cover: title; start/resolve times (UTC); customers; severity; impact summary; timeline; root cause; contributing factors; workaround; corrective action; preventive actions with owners/dates.

---

## 15. Admin team daily operating checklist

**Start of day:** critical/high tickets; overnight incidents; releases/maintenance; escalations; provider status; follow-ups due.

**During day:** classify new tickets; owners on criticals; updates sent; escalations include evidence; dedupe linked tickets.

**End of day:** handoff for open criticals; incident notes current; root-cause fields complete; trends flagged.

---

## 16. Recommended internal tools and data

Ticketing with severity; customer environment registry; deploy/release history; known-issue register; CloudWatch / alarms per [RUNBOOK.md](./RUNBOOK.md) and [infra/monitoring-and-ops.md](../infra/monitoring-and-ops.md); integration status payloads; Cognito visibility (per policy).

---

## 17. What not to do

Do not promise a fix before diagnosis; do not blame “the internet” without evidence; do not change production without notes; do not skip timestamps; do not close silently on no-reply unless policy allows; do not dismiss AI-quality reports without examples; do not reinstall before capturing version/environment trail.

---

## 18. Final operational standard

Operate like a mission-critical support center: identify impact quickly; collect precise facts; isolate the failing layer; test one change at a time; communicate clearly; escalate fast when beyond first line; document so the next occurrence resolves faster.

---

## 19. Recommended next deliverables

1. One-page quick triage cheat sheet (link to this doc + [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)).
2. Customer-facing intake form (align fields with §4).
3. Ticket template for Rapid Cortex cases.
4. Major incident communication template (align with §7).
5. Named escalation matrix (contacts rotate outside git).
6. Workstation validation checklist for agencies ([JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md) complements this).
7. Release validation checklist for web/API builds.
8. County/city/municipality IT training handbook ([INSTALLATION.md](./INSTALLATION.md), [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)).

---

*Internal use. Keep customer-facing commitments aligned with [PROMISE_CONTROL.md](./PROMISE_CONTROL.md) and [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md).*
