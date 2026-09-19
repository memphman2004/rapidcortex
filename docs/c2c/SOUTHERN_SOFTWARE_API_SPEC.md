# Southern Software CAD — API Requirements for Rapid Cortex C2C Integration

**Document purpose:** Exact API endpoints and fields required from Southern Software
to complete the Rapid Cortex C2C hub integration for Berkeley County (v21.2.238)
and Dorchester County (v25.2.241.32).

**Rapid Cortex contact:** api@rapidcortex.com
**Status:** Pending partner API agreement with Southern Software

---

## What we've built

The Rapid Cortex C2C hub is fully implemented:

- NENA EIDO JSON message format (APCO/NENA 2.105.1-2017)
- N-agency hub router with auto-transfer rules
- CJIS-compliant encryption (AES-256, RSA/X.509 mutual auth)
- Southern Software adapter (`apps/api/src/c2c/cad-adapters/southern-software.adapter.ts`)
- All field mappings from EIDO ↔ SS format (preliminary, to be confirmed)

**We need from Southern Software:** API credentials and documentation for the
endpoints listed below. We've already written the adapter code — we just need
to replace the stubs with live HTTP calls.

---

## Authentication

**Assumed:** API key authentication via `Authorization: ApiKey {key}` header.

**Confirm:** Header name, key rotation procedure, IP allowlist requirements.

---

## Required Endpoints (blocking)

### 1. List active incidents

```
GET /ssapi/v1/incidents
Query params:
  status=ACTIVE,DISPATCHED    (comma-separated)
  since=2026-09-17T21:00:00Z  (ISO 8601, return incidents modified after this time)
  limit=100
  cursor={opaque pagination cursor}
  agencyCode=BERK-SC

Expected response:
[
  {
    "incidentId": "2026-BERK-001234",
    "callType": "MVA",
    "priority": "1",
    "status": "DISPATCHED",
    "address": "1234 Main St",
    "city": "Moncks Corner",
    "county": "Berkeley",
    "latitude": 33.195,
    "longitude": -80.012,
    "callerName": "John Smith",
    "callerPhone": "+18435551234",
    "units": [
      { "unitId": "BERK-M1", "unitType": "MEDIC", "status": "ER", "enRouteAt": "..." }
    ],
    "narrative": [
      { "sequence": 1, "text": "...", "operator": "D01", "timestamp": "..." }
    ],
    "receivedAt": "2026-09-17T21:03:00Z",
    "updatedAt": "2026-09-17T21:05:00Z"
  }
]
```

**Confirm:** Field names, pagination mechanism, status values, date filter param name.

---

### 2. Get single incident

```
GET /ssapi/v1/incidents/{incidentId}
Returns: single incident object (same shape as above)
```

---

### 3. Create incident from external source ⚡ CRITICAL

This is the core of CAD-to-CAD. We need to create an incident in the SS CAD
that appears in the Berkeley/Dorchester dispatcher's queue as a cross-county
request for assistance.

```
POST /ssapi/v1/incidents
Body:
{
  "callType": "MVA",
  "priority": "1",
  "address": "I-26 and US-78",
  "city": "North Charleston",
  "county": "Berkeley",
  "latitude": 33.195,
  "longitude": -80.012,
  "callerName": "Charleston County 911",
  "callerPhone": "+18435551234",
  "externalSource": "RAPID_CORTEX_C2C",
  "externalIncidentId": "2026-CHAS-005678",
  "externalAgencyName": "Charleston County ECC",
  "notes": "Cross-county mutual aid request via C2C hub"
}

Expected response: created incident with SS-assigned incidentId
```

**Questions for SS:**
- Does SS have an "External Incident Receive" feature in v21+ and v25?
- What is the exact field name for the external source identifier?
- Does the incident appear in the dispatcher queue as a "pending" call?
- Are there any fields required beyond address + callType?
- What distinguishes a C2C incident from a locally-received call in the SS UI?

---

### 4. Update incident

```
PATCH /ssapi/v1/incidents/{incidentId}
Body: partial incident object (only changed fields)
```

---

### 5. Close incident

```
POST /ssapi/v1/incidents/{incidentId}/close
Body: { "dispositionCode": "CLR", "notes": "..." }
```

---

### 6. Record cross-agency dispatch confirmation

When Berkeley dispatches units in response to a Charleston County request, we
need to notify Charleston's CAD that units are responding.

```
POST /ssapi/v1/incidents/{incidentId}/crossagency-confirm
Body:
{
  "confirmingAgencyId": "BERK-SC",
  "confirmingAgencyName": "Berkeley County 911",
  "units": [
    { "unitId": "BERK-M1", "unitType": "MEDIC", "status": "DISPATCHED", "dispatchedAt": "..." }
  ],
  "timestamp": "2026-09-17T21:06:00Z"
}
```

**Alternate:** If SS doesn't have this endpoint, we can add a narrative entry
to the originating incident with the confirmation details.

---

### 7. Get unit roster

```
GET /ssapi/v1/units
Query params:
  status=AV,DP,ER  (available, dispatched, en route)
  agencyCode=BERK-SC

Expected response:
[
  { "unitId": "BERK-M1", "unitType": "MEDIC", "status": "AV", "callSign": "..." }
]
```

---

### 8. Get AVL positions

```
GET /ssapi/v1/avl
Query params:
  agencyCode=BERK-SC

Expected response:
[
  {
    "unitId": "BERK-M1",
    "latitude": 33.195,
    "longitude": -80.012,
    "heading": 270,
    "speed": 45,
    "timestamp": "2026-09-17T21:05:30Z"
  }
]
```

---

## Optional (preferred for production)

### 9. Webhook / event push

If Southern Software supports outbound webhooks, we would configure them
to POST events to our agency bridge endpoint. This eliminates 5-second
polling and gives sub-second latency.

```
POST /ssapi/v1/webhooks/register
Body:
{
  "url": "https://api.rapidcortex.com/c2c/inbound/BERK-SC",
  "events": ["INCIDENT_CREATED", "INCIDENT_UPDATED", "UNIT_STATUS_CHANGED"],
  "secret": "{HMAC secret for payload verification}"
}
```

---

## Status code mapping (to be confirmed)

| SS Status | APCO Status | Notes |
|---|---|---|
| ? | AVAILABLE | What does SS use? |
| ? | DISPATCHED | |
| ? | EN_ROUTE | |
| ? | ON_SCENE | |
| ? | CLEARED | |
| ? | OUT_OF_SERVICE | |

---

## Version differences (v21 vs v25)

Berkeley County runs v21.2.238, Dorchester County runs v25.2.241.32.

**Confirm:** Are there API endpoint differences between v21 and v25?
Do both support the create incident endpoint (v25 is more recent)?

---

## Next steps

1. Southern Software provides API documentation
2. Southern Software provisions API keys for dev environment
3. Rapid Cortex wires live HTTP calls into `SouthernSoftwareApiClient`
4. Integration test with non-production SS environment
5. Production deployment
