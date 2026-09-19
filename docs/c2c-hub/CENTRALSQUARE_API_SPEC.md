# CentralSquare — CAD partner API inquiry spec

**Status:** Rapid Cortex partner-program inquiry (not a bid, not a production integration).  
**Audience:** CentralSquare partner / API program (CAD Pro, Enterprise, OnDemand / Vertex adjacency).  
**Related demo:** Charleston County Consolidated 9-1-1 as the **receiving** PSAP on the Rapid Cortex C2C hub.

CentralSquare is a primary CAD vendor in large metro and consolidated 9-1-1 centers. Rapid Cortex already maps CentralSquare-style REST fields in `packages/integrations/cad/adapters/CentralSquareAdapter.ts` (`call_number`, `call_type`, `location.lat/lng`). This document is the **C2C / EIDO** ask.

## What we need (minimum viable C2C)

| Capability | Direction | Notes |
|---|---|---|
| Incident create / update | CAD → hub | `call_number`, `call_type`, `priority`, `call_status`, location |
| Incident close | CAD → hub | Status + timestamp |
| Incident ingest | hub → CAD | NENA EIDO JSON preferred; REST call create as fallback |
| OAuth2 | both | Client credentials; agency-scoped client id |
| Webhooks | CAD → hub | Optional; HMAC body signature |

## Proposed CAD JSON (inbound to Rapid Cortex)

```json
{
  "call_number": "CS-4410",
  "call_type": "STRUCTURE FIRE",
  "priority": 1,
  "call_status": "active",
  "location": {
    "address": "412 County Line Rd",
    "city": "Sangaree",
    "state": "SC",
    "lat": 33.012,
    "lng": -80.041
  },
  "received_at": "2026-09-18T15:10:00.000Z",
  "agency_id": "charleston-county-sc"
}
```

This matches the sample payload already used in Rapid Cortex `CentralSquareAdapter.sampleVendorPayloads()`.

## Proposed CAD ingest (outbound from Rapid Cortex)

Prefer: HTTP POST EIDO JSON to a CentralSquare CAD-to-CAD / Unify-adjacent endpoint.  
Fallback: POST `/api/calls` using the JSON above, with Rapid Cortex as `source_system`.

## Auth

- OAuth2 client credentials (current Rapid Cortex CentralSquare adapter assumption).
- Token audience limited to the agency tenant.
- Rotate client secret on a documented cadence (SOC 2 secrets SOP).

## Security / CJIS

- TLS 1.2+.
- No silent CAD write-back from Rapid Cortex (dispatcher review).
- Transfer audit includes EIDO `$id` and hub `ruleId`.

## Demo today

Charleston County is the sink in `packages/c2c-hub`. `CentralSquareC2cAdapter.mapVendorIncident` accepts the JSON above. The live mock uses an in-memory adapter so the demo runs without CentralSquare credentials.

## Contact ask

Please enroll Rapid Cortex in the CentralSquare **partner API / Unify-adjacent CAD-to-CAD program** and share:

1. Current CAD REST / event interface for incident share (Pro / Enterprise / OnDemand).
2. EIDO (NENA-STA-021) support or roadmap.
3. Sandbox tenant.
4. A technical contact who can speak to Charleston County Consolidated 9-1-1 evaluations.

This is **not** a response to Charleston County RFP 6212-27L. Rapid Cortex is not bidding that RFP as prime.
