# Universal CAD Integration Strategy for Rapid Cortex

## Executive Summary

To position Rapid Cortex as the AI layer for 911, we need a **universal CAD integration architecture** that works with all major vendors plus a long-tail of smaller systems.

**Strategic goal:** Rapid Cortex is CAD-agnostic AI intelligence  
**Tagline:** "Works with your CAD system - no replacement required"  
**Value proposition:** Agencies keep their CAD investment and add AI capabilities.

---

## Strategic Vision

Rapid Cortex becomes the intelligence layer above CAD systems, not a CAD replacement:

- Read from CAD where possible
- Normalize and enrich with AI
- Keep write-back controlled behind a separate hard gate
- Offer fallback paths when direct APIs are unavailable

---

## Architecture: Universal CAD Integration Framework

### Three-Tier (+ fallback) Integration Strategy

1. **Tier 1 - Direct vendor APIs**
2. **Tier 2 - Partner layer (RapidSOS)**
3. **Tier 3 - Generic standards (CAP/NIEM)**
4. **Tier 4 - Manual/Hybrid fallback**

This layering allows broad compatibility without blocking go-live on one vendor path.

---

## Tier 1: Direct Vendor Integrations (Priority)

### Priority matrix

| Vendor | Market Share (estimated) | Integration Complexity | Priority | Timeline |
|---|---:|---|---|---|
| Tyler Technologies | ~30% | Medium | P0 | Weeks 1-3 |
| Motorola Solutions | ~25% | High | P0 | Weeks 2-4 |
| Hexagon (Intergraph) | ~15% | Medium | P1 | Weeks 3-5 |
| CentralSquare | ~10% | Medium | P1 | Weeks 4-6 |
| Mark43 | ~5% | Low | P1 | Weeks 5-6 |
| Spillman (Motorola) | ~3% | Medium | P2 | Weeks 7-8 |

### Universal adapter contract

```typescript
export interface UniversalCadAdapter {
  vendor: CadVendor;
  version: string;
  capabilities: CadCapabilities;

  authenticate(): Promise<AuthResult>;
  healthCheck(): Promise<HealthStatus>;
  disconnect(): Promise<void>;

  getIncident(id: string): Promise<CadIncident>;
  searchIncidents(query: IncidentQuery): Promise<CadIncident[]>;
  getActiveIncidents(): Promise<CadIncident[]>;
  getIncidentHistory(id: string): Promise<CadEvent[]>;

  getUnit(id: string): Promise<CadUnit>;
  getActiveUnits(): Promise<CadUnit[]>;
  getUnitStatus(id: string): Promise<UnitStatus>;

  getIncidentLocation(id: string): Promise<Location>;
  reverseGeocode(lat: number, lng: number): Promise<Address>;

  // Optional Phase-2 write operations
  createIncident?(incident: IncidentCreate): Promise<CadIncident>;
  updateIncident?(id: string, update: IncidentUpdate): Promise<CadIncident>;
  dispatchUnit?(incidentId: string, unitId: string): Promise<DispatchResult>;
  updateUnitStatus?(unitId: string, status: UnitStatus): Promise<void>;

  subscribeToIncidents?(cb: (incident: CadIncident) => void): Promise<Subscription>;
  subscribeToUnits?(cb: (unit: CadUnit) => void): Promise<Subscription>;

  mapToStandard(vendorData: unknown): CadIncident | CadUnit;
  mapFromStandard(standardData: CadIncident | CadUnit): unknown;
}
```

### Normalized incident types

Define a standard incident taxonomy (50+ codes) and map each vendor’s local codes into it (for triage, analytics, and QA consistency).

---

## Tier 2: RapidSOS Integration Layer

### Why this matters

- Provides broad PSAP reach
- Adds enriched caller context (location/device/etc.)
- Enables faster time-to-value when direct CAD APIs are constrained
- Serves as fallback or supplemental feed

### Recommended usage

- Primary path for agencies with weak/closed CAD APIs
- Enrichment path on top of Tier 1 data
- Failover data source where contractually allowed

---

## Tier 3: Generic Standards (CAP/NIEM)

### CAP

- XML-based emergency alert standard
- Supports smaller vendors and alerting systems

### NIEM

- Public safety/government data exchange model
- Useful for state/federal exchange contexts

Standards support extends long-tail compatibility without bespoke vendor work for each system.

---

## Tier 4: Manual/Hybrid Fallback

Fallback options when direct integration is unavailable:

- Scheduled file import (CSV/JSON/XLSX)
- Configurable field mapping UI
- Strictly controlled/manual workflows

Use this as a bridge strategy, not long-term default for high-volume agencies.

---

## Implementation Roadmap

### Phase 1 (Weeks 1-2): Foundation

- Define universal adapter interfaces and standard models
- Build adapter factory/registry
- Build adapter test harness
- Deliver one vendor adapter for pilot customer

### Phase 2 (Weeks 3-6): Core coverage

- Add top 2-3 vendors in parallel
- Add RapidSOS adapter for coverage acceleration
- Validate cross-vendor normalization

### Phase 3 (Weeks 7-12): Long-tail coverage

- Remaining high-priority vendors
- CAP/NIEM adapters
- File-import fallback and field mapper

### Phase 4 (Weeks 13-16): Production hardening

- Retries/circuit breakers/failover behavior
- Monitoring dashboards and alarms
- Vendor certification and security reviews

---

## Vendor Implementation Notes

### Tyler

- REST + OAuth2 client credentials
- Strong candidate for first adapter depending on pilot customer

### Motorola

- Commonly API-key based in PremierOne deployments
- Agency-specific variations expected

### Hexagon

- SOAP/REST hybrid patterns in some environments

### CentralSquare

- REST-oriented, moderate integration effort

### Mark43

- Modern API ergonomics, often lowest adapter complexity

---

## Universal Field Mapping System

### Problem

Vendor payloads differ by schema and code vocabulary.

### Approach

- Baseline static mapping templates per vendor/version
- Agency-specific mapping overlay
- Optional AI-assisted field detection with human review
- Versioned mappings and regression tests

---

## Deployment and Onboarding Flow

1. Discovery: vendor/version/auth/network constraints
2. Select integration tier and fallback tier
3. Configure adapter + credentials in staging
4. Validate read path, error paths, and tenant isolation
5. Pilot in read-only mode
6. Promote after evidence/signoff gates

---

## Sales and GTM Positioning

Position by outcome:

- "Keep your CAD; add AI intelligence fast."
- "Vendor-neutral architecture; no forced migration."
- "Read-only pilot first, controlled write-back only after approvals."

---

## Engineering Implementation Guide (Cursor)

### Target module layout

- `apps/api/src/integrations/cad/UniversalCadAdapter.ts`
- `apps/api/src/integrations/cad/models/*`
- `apps/api/src/integrations/cad/adapters/*`
- `apps/api/src/integrations/cad/CadAdapterFactory.ts`
- `apps/api/src/integrations/cad/FieldMapper.ts`
- `apps/api/src/integrations/cad/__tests__/*`

### Required resilience patterns

- Retries with backoff for transient errors
- Circuit breaker per adapter
- Health telemetry per vendor/agency
- Safe degradation to read-only/manual modes

### Testing requirements

1. Unit tests: mapping + validation + normalization
2. Integration tests: vendor staging auth/read/error paths
3. Negative tests: timeout/down/malformed/rate-limit
4. Cross-tenant tests: no data leakage between agencies

---

## Governance Constraints

- CAD write-back remains a separate hard gate
- Per-agency feature flags and explicit approvals required
- Full audit trail on every integration read/write attempt
- CJIS-aligned controls where CJI is in scope

---

## Definition of Done (Universal CAD Program)

- At least one real vendor adapter in production pilot
- Standard model coverage validated across top vendors
- Tier 2/3/4 fallback paths documented and tested
- Monitoring + alerts + runbooks complete
- Customer-facing deployment playbook finalized
