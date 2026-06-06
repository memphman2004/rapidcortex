# Rapid Cortex — Product one-pager (MVP)

**Canonical pilot/MVP scope:** [../MVP_SCOPE.md](../MVP_SCOPE.md) · **Non-goals:** [../NON_GOALS.md](../NON_GOALS.md) · **Commercial packaging (no scope override):** [../PRODUCT_OVERVIEW.md](../PRODUCT_OVERVIEW.md), [../FEATURE_MATRIX.md](../FEATURE_MATRIX.md)

## Tagline

**Real-time AI intelligence for emergency response.**

## What Rapid Cortex is

A **browser-based, AWS-native SaaS co-pilot** for emergency communications centers: live (or simulated) transcription, **human-in-the-loop** triage support, **protocol-backed** operational phrases, and structured decision support—presented in a **dispatcher-first dashboard** with **supervisor** and **admin** workflows.

## What it is not (MVP boundary)

- **Not** a full **911 / PSAP replacement**, CAD system, or telephony stack.
- **Not** a substitute for agency policy, medical control, or dispatcher judgment.
- **Not** “fully CJIS compliant” as a marketing claim—see **CJIS-aligned** controls in architecture docs.

## Side-by-side deployment model

Rapid Cortex is designed to run **alongside** existing systems (CAD, phone, radio, logging) as an **intelligence layer**: ingest or simulate audio/transcript, maintain agency-scoped incidents, surface AI + protocol guidance, and emit audit-friendly events. **No hard dependency** on a single vendor in core product code—integrations use **adapters** (`packages/integrations`).

**Public web entry:** pilot and production UIs are served at **`https://www.rapidcortex.us/<city-town-or-county-name>/…`** (one path segment per jurisdiction site, e.g. Columbus vs. a county), with the API on a dedicated host such as **`https://api.rapidcortex.us`**.

## Target users

| Role | Primary job in product |
|------|-------------------------|
| **Dispatcher** | Operate live incident workspace, transcript, AI panel, protocol coach, escalation cues. |
| **Supervisor** | Queue / review escalated or flagged incidents, validate AI summaries, coaching. |
| **Admin** | Users, roles, agency settings placeholders, audit visibility, integration placeholders. |

## Pilot assumptions — Columbus & Erie

- **Single-agency pilots** with **dedicated Cognito pools** (or logical separation) per pilot where possible.
- **Demo-first**: simulated transcript streaming acceptable; path to **AWS Transcribe** (or vendor audio) documented, not blocking pilot UX.
- **Training-heavy rollout**: success depends on **dispatcher trust** and **supervisor review**, not raw model accuracy alone.
- **Data minimization**: transcripts and analyses treated as **sensitive**; retention and access logging are first-class (see Phase 0 risk register).

## Protocol-backed guidance (rule)

For life-safety and operational instructions (CPR, AED, choking, bleeding, evacuation, domestic/silent caller patterns, etc.), **instructional content must come from agency-approved protocol packs** (structured config), not free-form LLM invention. The LLM may **classify, summarize, and suggest next questions** within schema; **phrases coaches repeat to callers** follow **protocol engine** output.

## Human-in-the-loop (rule)

AI **assists**; it does **not** replace the dispatcher. Every critical path assumes a **human approves** escalation, routing narrative, and use of suggested wording.

## AI tone and safety (rules)

- **Calm, concise, supportive**—experienced coach, not chatty.
- **Short, actionable** lines; one primary **next question** in structured output.
- **Non-authoritative** language (“consider,” “may indicate,” not “diagnosis”).
- **Structured outputs only** at persistence boundaries (Zod-validated).
- **Fail closed**: provider errors fall back or surface a clear **degraded** state—no silent invention.

## Success metrics (pilot)

| Metric | Definition |
|--------|------------|
| **Time-to-first-good-demo** | Stakeholder completes guided demo without engineer in the room. |
| **Dispatcher usability** | Task success on scripted scenarios (find incident, read transcript, interpret AI + protocol). |
| **Supervisor trust** | % of flagged incidents reviewed within SLA; qualitative feedback. |
| **Safety / audit** | 100% of analysis runs and transcript appends tied to **agency + actor** in audit trail. |
| **Reliability** | Uptime / error budget for API + web during pilot window. |

## Build order (high level)

1. Dashboard + demo data path  
2. Auth + agency scoping  
3. Transcript pipeline (sim → live-ready)  
4. AI providers + validation  
5. Protocol engine + UI  
6. Supervisor / admin + audit  
7. Integration adapters + CJIS-aligned hardening  

See [mvp-features.md](./mvp-features.md) for the detailed list.
