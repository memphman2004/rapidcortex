# Non-goals — MVP, near-term, and first-agency pilot

**Canonical non-goals document.** Stakeholders should sign off on this file together with [MVP_SCOPE.md](./MVP_SCOPE.md). Pilot launch checks reference it from [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md).

[phase-0/non-goals.md](./phase-0/non-goals.md) defers here. **[PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md)** is the **operational** pilot/sales quick reference (tables and “never promise” list); the **authoritative** exclusions remain in this file.

---

## 1. Product and market

- **Replacing** primary 911 call-taking, full CAD, radio console, or logging as the system of record.
- **Guaranteed** sub-second nationwide latency for every agency edge case.
- **Certified** CJIS, HIPAA, FedRAMP, or SOC 2 **claims** without a completed assessment program—controls may be CJIS-*aligned* in engineering docs only.
- **Consumer** emergency reporting (product is **B2G / agency** software).
- **Nationwide or multi-tenant self-serve GA** — pilot onboarding, pricing, and support are **pilot-shaped**, not unconstrained public SaaS.
- **Universal CAD / RMS / 911 vendor certification** — each vendor combination is a **project** (see [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).
- **Full radio console replacement** — assistive co-pilot only.

## 2. Technical

- **Native desktop** client as the **primary** delivery (web remains primary).
- **Hard-coding** a single audio vendor, CAD vendor, or device SDK in **core** app code (use `packages/integrations` adapters).
- **LLM-generated** medical or tactical **procedures** presented as authoritative **without** protocol pack backing for those procedures ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).
- **Storing** raw secrets in repo, committed env files, or **client-exposed** API keys.
- **Guaranteed** sub-second AI latency — bounded by provider and network; UX must surface loading and degraded states.
- **Offline-first mobile apps** for the pilot — browser deployment per [USER_GUIDE.md](./USER_GUIDE.md).

## 3. Data and ML

- **Training** customer-specific models on production pilot transcripts **by default** without explicit legal/program approval.
- **Automatic** outbound actions (auto-dispatch, **auto-CAD write**, unsupervised write-back) without human confirmation—interface hooks may exist; production automation is out of scope until reopened with legal and vendor review ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).
- **Automatic legal discovery / retention legal hold workflows** — retention expectations are agency-led; see [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md).

## 4. Organizational and commercial

- **Multi-tenant arbitrary self-signup** without agency onboarding and legal review.
- **Unbounded** retention of full transcripts without agency policy and technical hooks (agency must define retention posture; product direction in [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).
- **24/7 vendor NOC** for third-party AI or cloud—escalation paths are in [RUNBOOK.md](./RUNBOOK.md); provider incidents follow vendor support.

## 5. Demo and training paths (isolated)

These remain **non-goals for live pilot operations** (they are in scope for **training and UX validation** only):

- **`/demo`** scenario runner — scripted playback and preview analysis; **not** live CAD/radio ingest.
- **Demo API routes** (`/api/demo/*`) — authenticated training starts; **not** a substitute for production incident creation workflows.
- **Offline mock incidents on the dispatcher dashboard** — **disabled by default**. The product shows an explicit **training/offline** state unless `NEXT_PUBLIC_OFFLINE_DEMO_MODE=1` is set (local/sales only). Pilot hosts must configure the real API ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)).
- **Scripted transcript chunk player on `/dashboard`** — **off by default** when the API is configured. Use `/demo` for academy scenarios, or set `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM=1` (and offline demo mode already enables it for local-only builds).

When scope expands, update **this file**, [MVP_SCOPE.md](./MVP_SCOPE.md), and [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md).
