# CAD Integration Architecture

## Purpose

NexCort iQ supports a vendor-neutral CAD adapter framework so agencies can integrate their existing CAD
systems without hardcoding vendor logic into the core application.

NexCort iQ does **not** replace CAD.

## Key design principles

- CAD integration is optional per agency.
- Read-only behavior comes first.
- Mock mode supports demos and testing without vendor credentials.
- CAD write-back is never automatic.
- Every write-back action requires explicit human approval (unless a routing rule explicitly allows skip for privileged roles).
- Every write-back action is audited.
- Vendor adapters are reusable across agencies with agency-scoped configuration.
- Live vendor HTTP write-back is **fail-closed** unless `CAD_WRITEBACK_ENABLED` is explicitly `true` / `1`.

## Canonical live path (Multi-CAD Connector)

Production agencies connect through the Multi-CAD Connector:

| Layer | Path |
|-------|------|
| Shared vendor IDs / Zod | `packages/shared/src/cad-connector/` |
| Vendor adapters + Dynamo stores | `packages/integrations/cad/` |
| Lambda HTTP | `/api/cad-connector/*` (stack CAD connector) |
| Web UI | `/{jurisdiction}/cad/connectors` via `CadConnectorManager` |

Adapters extend `RestCadAdapterBase` and are resolved only via `CadAdapterRegistry`. Agencies supply:

1. `vendorId` from `CAD_VENDOR_IDS`
2. `baseUrl` for the agency CAD endpoint
3. Credentials in **Secrets Manager** (`secretArn` — never plaintext in Dynamo or browser responses)
4. Optional per-agency `fieldMappings` (defaults ship per vendor; validate in sandbox before cutover)

Mock E2E (no live CAD): set connector mock mode (`CAD_CONNECTOR_MOCK` / `isCadConnectorMock()`) so health, fetch, and write-back use sample payloads.

## Supported connector vendors

| `vendorId` | Product |
|------------|---------|
| `motorola_premierone` | Motorola PremierOne |
| `tyler_new_world` | Tyler New World |
| `hexagon_intergraph` | Hexagon I/CAD |
| `central_square` | CentralSquare / TriTech |
| `spillman` | Spillman Flex |
| `mark43` | Mark43 |
| `caliber` | Caliber Public Safety |
| `versaterm` | Versaterm (CAD / Public Safety Suite) |
| `rapiddeploy` | RapidDeploy (Cloud Aided Dispatch) |
| `zetron` | Zetron / Intertalk |
| `eforce` | EFORCE CAD |
| `cody` | CODY CAD |
| `sunridge_rims` | Sunridge Systems (RIMS) |
| `kabat_one` | KabatOne (K-Dispatch) |
| `oracle_psdc` | Oracle Public Safety Dispatch Command Center |
| `generic_rest` | Generic REST (agency-supplied mappings required) |

Default REST paths and field mappings are connectable scaffolding. Vendor-certified contracts require agency sandbox credentials and approved field-mapping review before production cutover.

## Pilot / local adapter surface (Next BFF)

Documented for demos and local smoke tests — **not** the production write path:

- `apps/web/lib/rapid-cortex/cad/`
- `cad-adapter.ts` — shared adapter interface
- `types.ts` — normalized CAD models and result types
- `cad-adapter-factory.ts` — adapter resolution by vendor/config
- `adapters/mock-cad-adapter.ts` — fully functional mock adapter
- `adapters/*-adapter.ts` — placeholder vendor adapters (safe not-configured responses)
- `writeback/cad-writeback-service.ts` — approval-gated write-back (enforces `writebackEnabled`)
- `audit/cad-audit-service.ts` — in-process audit capture

Pilot API routes:

- `POST /api/cad/health`
- `POST /api/cad/incidents/search`
- `GET /api/cad/incidents/[incidentId]`
- `POST /api/cad/incidents/[incidentId]/notes`
- `POST /api/cad/incidents/[incidentId]/media`
- `POST /api/cad/incidents/[incidentId]/disposition`
- `POST /api/cad/writeback/request`
- `POST /api/cad/writeback/approve`

## Write-back safety policy

Allowed (approval required):

- `addNarrativeNote`
- `attachMediaLink`
- `updateDisposition`

Blocked by default:

- `dispatchUnit`
- `changePriority`
- `closeIncident`
- `deleteIncident`

Environment gates (all fail-closed when unset):

| Layer | Flag |
|-------|------|
| API / Connector deliver | `CAD_WRITEBACK_ENABLED` |
| Web BFF / pilot service | `CAD_WRITEBACK_ENABLED` (`isCadWritebackEnvEnabled`) |
| Web UI | `NEXT_PUBLIC_ENABLE_CAD_WRITEBACK` |
| Connector product surface | `ENABLE_CAD_CONNECTOR` / `NEXT_PUBLIC_ENABLE_CAD_CONNECTOR` |

Never enable write-back in prod/staging until go/no-go criteria and the CAD writeback addendum are met.

## Connect checklist (agency go-live)

1. Enable Multi-CAD Connector addon (`cad.connector`) for the agency.
2. Create a connector with the correct `vendorId`, `baseUrl`, and Secrets Manager ARN.
3. Run **health-check** and **test-fetch** (use mock mode first in non-prod).
4. Review default field mappings; adjust required inbound/outbound fields for the agency CAD schema.
5. Keep `CAD_WRITEBACK_ENABLED` off until approval workflow and sandbox write tests pass.
6. Submit a write-back → supervisor approve → confirm vendor receipt only after the env gate is explicitly enabled.

## Security and data handling

- Never expose secrets in browser responses.
- Never log secrets or raw credentials.
- Always scope requests by authenticated user agency.
- Return user-safe error messages for unconfigured adapters.
- Connector and pilot write-back delivery both refuse live vendor POST when write-back is disabled.

## Future enhancements

- Persist pilot CAD audit events into durable backend storage (connector path already uses Dynamo).
- Add agency-admin workflow refinements for vendor credential rotation.
- Add vendor-specific request/response mapping contracts with contract tests per sandbox certification.
- Add per-agency write-back policy controls and multi-step approval chains.
