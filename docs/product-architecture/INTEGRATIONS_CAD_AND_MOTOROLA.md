# Integrations — CAD systems and Motorola-class environments

This document explains **how Rapid Cortex approaches CAD (Computer-Aided Dispatch) integration**, with **Motorola Solutions–class** environments called out as a common U.S. public-safety scenario. It is **not** a Motorola licensing or product manual; your agency’s **contracted interfaces**, **CJIS controls**, and **vendor professional services** are authoritative.

## Product stance (today)

- Rapid Cortex ships **adapter interfaces** and **mock implementations** in `packages/integrations` (for example `CadAdapter`, `MockCadAdapter`). See [`cad-adapter.ts`](../packages/integrations/src/cad-adapter.ts).
- The **live CAD connector is not productized** in this repository as a turnkey Motorola (or other vendor) module. The admin UI shows CAD as **planned** alongside other connectors (`apps/web/lib/connection-status.ts`), under **`https://www.rapidcortex.us/<city-town-or-county-slug>/admin/integrations`** (and related admin routes).
- The API exposes **`GET /api/integration/status`**, which today surfaces **transcript connector rollout** flags (`INTEGRATION_TRANSCRIPT_CONNECTOR_MODE`, `INTEGRATION_TRANSCRIPT_AGENCY_ALLOWLIST`) from `apps/api/src/lib/integration-surface.ts`. CAD-specific health will evolve with real adapters.

This matches the **side-by-side** model in [`docs/phase-0/product-one-pager.md`](./phase-0/product-one-pager.md): Rapid Cortex is an **intelligence layer**, not a CAD replacement.

For strict rollout instructions, use the operational playbook:

- [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md) — step-by-step pilot/production connection process, validation, and rollback.

## Why “Motorola CAD” is not one universal API

Agencies often say **“Motorola CAD”** to mean Motorola Solutions’ **CAD / command** portfolio. In practice, integration depends on:

- **Which product generation** is in use (names and capabilities change over time).
- **What your contract includes** (some interfaces are optional modules or professional-services engagements).
- **Topology**: hosted vs on-prem, **CAD-to-CAD** middleware, regional data centers, and **CJIS** networking (VPN, private interconnect, allow-listed IPs).
- **Read vs write**: read-only incident visibility is very different from **write-back** of narrative or disposition codes.

**Rapid Cortex engineering** should therefore treat “Motorola integration” as a **discovery and design** exercise with your agency and the vendor, then implement a **narrow adapter** behind `CadAdapter` (or adjacent interfaces such as incident event feeds).

## Recommended integration phases

### Phase A — Discovery (weeks; involve vendor TAM / PS)

1. **Inventory systems**: CAD product name/version, RMS, logging recorder, 911 CPE, and any **middleware** already licensed.
2. **List integration options** the vendor supports for _your_ deployment: APIs, message buses (for example JMS/Kafka-style where offered), **XML/JSON** incident feeds, **webhooks**, **FTP/SFTP** drops, CAD-to-CAD, etc.
3. **Define data scope**: which fields Rapid Cortex needs (incident id, type, location, units, timestamps, narrative snippets) and what must **never** leave CAD (some agencies restrict narrative export).
4. **Security path**: CJIS alignment, encryption in transit (TLS 1.2+), authentication (OAuth, mutual TLS, API keys in HSM-backed stores), and **audit** requirements.

### Phase B — Read-only “shadow” (recommended first technical milestone)

- Ingest **incident updates** or **transcript-adjacent** events into Rapid Cortex **without** controlling dispatch.
- Align with transcript connector philosophy: use **`INTEGRATION_TRANSCRIPT_CONNECTOR_MODE=shadow`** (or `off` / `on` per `packages/integrations` rollout) so you can compare external feed behavior to existing mock/live paths before full reliance.

### Phase C — Operator-visible “on”

- Enable **`on`** for allow-listed agencies after validation.
- Maintain **human-in-the-loop** for any suggestion that could influence dispatch or medical decisions (see [NON_GOALS.md](./NON_GOALS.md)).

### Phase D — Write-back (only with explicit governance)

- `CadAdapter.pushSummary` exists as an interface hook; **automatic CAD updates** are a **non-goal** for MVP unless reopened with legal and vendor review ([NON_GOALS.md](./NON_GOALS.md)).
- Any write-back requires **dual authorization**, **idempotency**, **replay protection**, and **audit** events mapped to your agency’s vocabulary (`packages/security`).

## Technical mapping in this codebase

| Concept                  | Location                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| CAD read / write surface | `CadAdapter` in `packages/integrations`                                  |
| Mock CAD                 | `MockCadAdapter`                                                         |
| Integration health model | `packages/integrations/src/integration-health.ts` (`connectorId: "cad"`) |
| Admin “integrations” UX  | Web admin pages + `connection-status.ts` placeholders                    |
| Transcript rollout flags | Lambda env + `GET /api/integration/status`                               |

When you implement a vendor-specific adapter:

1. **Keep vendor SDKs and credentials out of** `apps/web` — run them in **Lambda** or a dedicated integration service.
2. **Normalize** vendor payloads into internal shapes (`packages/integrations` normalized event types where applicable).
3. **Emit audit events** when connectors change state (hint string returned by integration status today points at audit vocabulary alignment).

## Motorola Solutions engagement (practical checklist)

Use this list with your **Motorola Solutions account team**; wording may change by product:

- [ ] Confirm **product names**, versions, and **hosting** model.
- [ ] Request the **integration catalog** for your SKU: supported protocols, rate limits, test environments.
- [ ] Request a **non-production** endpoint for Rapid Cortex development.
- [ ] Agree on **network path** (public internet vs private connectivity) and **IP allow lists**.
- [ ] Agree on **data elements** available in each message and **retention** constraints.
- [ ] Plan **fallback**: if the feed stalls, dispatch continues in CAD per your SOP.

## Support model

- **Agency IT / Motorola support** own CAD uptime and interface contracts.
- **Rapid Cortex engineering** owns adapter code inside this repo and AWS resources defined in `infra/template.yaml`.

## Related documents

- [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md) — strict operational rollout checklist for CAD discovery, read-only, assisted write-back, and rollback.
- [`docs/NON_GOALS.md`](./NON_GOALS.md) — MVP and pilot boundaries.
- [`docs/PILOT_READINESS.md`](./PILOT_READINESS.md) — hub; checklist in [`docs/PILOT_READINESS_CHECKLIST.md`](./PILOT_READINESS_CHECKLIST.md).
- [RUNBOOK.md](./RUNBOOK.md) — operational checks.
- [INSTALLATION.md](./INSTALLATION.md) — deploy prerequisites.
