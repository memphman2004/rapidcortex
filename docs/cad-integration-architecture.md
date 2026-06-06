# CAD Integration Architecture

## Purpose

Rapid Cortex supports a vendor-neutral CAD adapter framework so agencies can integrate their existing CAD
systems without hardcoding vendor logic into the core application.

Rapid Cortex does **not** replace CAD.

## Key design principles

- CAD integration is optional per agency.
- Read-only behavior comes first.
- Mock mode supports demos and testing without vendor credentials.
- CAD write-back is never automatic.
- Every write-back action requires explicit human approval.
- Every write-back action is audited.
- Vendor adapters are reusable across agencies with agency-scoped configuration.

## Adapter architecture

Primary module path:

- `apps/web/lib/rapid-cortex/cad/`

Core files:

- `cad-adapter.ts` - shared adapter interface.
- `types.ts` - normalized CAD models and result types.
- `cad-adapter-factory.ts` - adapter resolution by vendor/config.
- `adapters/mock-cad-adapter.ts` - fully functional mock adapter.
- `adapters/*-adapter.ts` - placeholder vendor adapters (safe not-configured responses).
- `writeback/cad-writeback-service.ts` - approval-gated write-back orchestration.
- `audit/cad-audit-service.ts` - audit event capture service.

## Supported vendor placeholders

- Motorola
- CentralSquare
- Tyler Technologies
- Hexagon / Intergraph
- Generic Custom CAD
- Mock CAD

Real API integration remains TODO until vendor API access, credentials, and approved field mapping are available.

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

## API surface (protected routes)

- `POST /api/cad/health`
- `POST /api/cad/incidents/search`
- `GET /api/cad/incidents/[incidentId]`
- `POST /api/cad/incidents/[incidentId]/notes`
- `POST /api/cad/incidents/[incidentId]/media`
- `POST /api/cad/incidents/[incidentId]/disposition`
- `POST /api/cad/writeback/request`
- `POST /api/cad/writeback/approve`

## Security and data handling

- Never expose secrets in browser responses.
- Never log secrets or raw credentials.
- Always scope requests by authenticated user agency.
- Return user-safe error messages for unconfigured adapters.

## Future enhancements

- Persist CAD audit events into durable backend storage.
- Add agency-admin workflow for vendor credential configuration.
- Add vendor-specific request/response mapping contracts with contract tests.
- Add per-agency write-back policy controls and approval chains.
