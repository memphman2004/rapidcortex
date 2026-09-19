# Southern Software — CAD partner API inquiry spec

**Status:** Rapid Cortex partner-program inquiry (not a bid, not a production integration).  
**Audience:** Southern Software partner / API program.  
**Related demo:** Berkeley County Combined Dispatch (mock) → Charleston County via NENA EIDO.

Southern Software CAD is widely deployed in South Carolina and the Southeast. This document is the **ask** we send with a partner inquiry so their API team can tell us which interfaces they already expose for CAD-to-CAD.

## What we need (minimum viable C2C)

| Capability | Direction | Notes |
|---|---|---|
| Incident create / update | CAD → hub (push or poll) | Call number, type, priority, location, units, comments |
| Incident close / cancel | CAD → hub | Status + timestamp |
| Unit status | CAD → hub | Optional for v1 |
| Incident ingest | hub → CAD | Accept NENA EIDO JSON **or** mapped CAD fields below |
| Auth | both | TLS + agency-scoped API key or mutual TLS; no shared “superuser” |

We normalize every incident to **NENA-STA-021 EIDO JSON** on the hub. If Southern Software already emits EIDO, we ingest that document as-is. If not, we map the CAD payload below.

## Proposed CAD JSON (inbound to Rapid Cortex)

```json
{
  "CallNumber": "BKC-1001",
  "CallType": "STRUCTURE FIRE",
  "Priority": 1,
  "Status": "Active",
  "Address": "412 County Line Rd",
  "City": "Sangaree",
  "State": "SC",
  "Latitude": 33.012,
  "Longitude": -80.041,
  "Comments": "Exposures on the Charleston County side of the line.",
  "CreateTime": "2026-09-18T15:10:00.000Z",
  "AgencyOri": "SC-BERKELEY"
}
```

Field names follow typical Southern Software CAD export labels (`CallNumber`, `CallType`). Confirm exact names in the partner kit.

## Proposed CAD ingest (outbound from Rapid Cortex)

Prefer: HTTP POST `application/json` NENA EIDO (`eidoVersion: "1.0"`, `$id` URN).  
Fallback: same CAD JSON shape as above, `AgencyOri` of the **receiving** PSAP.

## Webhook / poll

- **Push (preferred):** CAD POSTs incident events to `https://api.rapidcortex.us/api/c2c/vendors/southern-software/events` (agency JWT or HMAC).
- **Poll:** Rapid Cortex GET `/cad/incidents?since=` if push is not available.

## Security / CJIS

- TLS 1.2+.
- Agency-scoped credentials in AWS Secrets Manager on the Rapid Cortex side.
- No CAD write-back without dispatcher review (Rapid Cortex policy).
- Audit every transfer (`transferId`, rule, EIDO `$id`).

## Demo today

`packages/c2c-hub` mock adapter simulates Berkeley County CAD using this mapping (`SouthernSoftwareAdapter.mapVendorIncident`).

## Contact ask

Please enroll Rapid Cortex in the Southern Software **partner API program** and share:

1. CAD-to-CAD or third-party incident interface guide (current release).
2. Whether EIDO JSON is supported, planned, or not on the roadmap.
3. Sandbox / test agency credentials.
4. A technical contact for Charleston County / Berkeley County SC discussions.

This is **not** a response to Charleston County RFP 6212-27L.
