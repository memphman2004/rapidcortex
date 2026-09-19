# CentralSquare Enterprise CAD — API Requirements for Rapid Cortex C2C Integration

**Document purpose:** Exact API endpoints required from CentralSquare to complete
the Rapid Cortex C2C hub integration for Charleston County Consolidated ECC
(CentralSquare Enterprise CAD v21.1.2 Patch 4).

**Rapid Cortex contact:** api@rapidcortex.com
**Reference:** CentralSquare Open Platform / External Interface program

---

## What we've built

- Full NENA EIDO C2C hub with CJIS-compliant encryption
- CentralSquare Enterprise adapter (`apps/api/src/c2c/cad-adapters/centralsquare.adapter.ts`)
- OAuth2 client credentials flow (standard, ready for your token endpoint)
- EIDO ↔ CentralSquare field mapping (preliminary, to be confirmed with your docs)

**We need from CentralSquare:** OAuth2 client credentials (client_id + client_secret),
token URL, scope list, and confirmation of the endpoints below.

---

## Authentication

**Mechanism:** OAuth2 client credentials grant (standard RFC 6749)

```
POST {your-auth-token-url}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={RC_CLIENT_ID}
&client_secret={RC_CLIENT_SECRET}
&scope=incidents:read incidents:write units:read avl:read
```

**Confirm:** Token URL, exact scope names, token lifetime, refresh mechanism.

---

## Required Endpoints

### 1. List active incidents

```
GET /cs-enterprise/api/v1/incidents
Authorization: Bearer {access_token}
Query params:
  modifiedAfter=2026-09-17T21:00:00Z
  status=ACTIVE,DISPATCHED
  limit=100
  offset=0

Expected response:
{
  "incidents": [
    {
      "incidentNumber": "2026-CC-001234",
      "callTypeCode": "MVC",
      "callTypeDescription": "Motor Vehicle Crash",
      "priorityCode": "1",
      "incidentStatus": "DISPATCHED",
      "locationAddress": "4045 Bridge View Dr",
      "locationCity": "North Charleston",
      "locationState": "SC",
      "locationCounty": "Charleston",
      "gisLatitude": 32.868,
      "gisLongitude": -79.986,
      "callerName": "Jane Doe",
      "callerPhone": "+18435551234",
      "respondingUnits": [...],
      "comments": [...],
      "createDateTime": "2026-09-17T21:03:00Z",
      "lastUpdateDateTime": "2026-09-17T21:05:00Z"
    }
  ],
  "total": 45,
  "hasMore": false
}
```

**Confirm:** Exact endpoint path, authentication scope, field names, pagination.

---

### 2. Get single incident

```
GET /cs-enterprise/api/v1/incidents/{incidentNumber}
Authorization: Bearer {access_token}
```

---

### 3. Create external incident ⚡ CRITICAL

This is the most important endpoint for the entire integration.
We need to create a new incident in Charleston County's CS Enterprise CAD
that appears in the dispatcher's queue as a cross-county request.

```
POST /cs-enterprise/api/v1/incidents
Authorization: Bearer {access_token}
Scope required: incidents:write

Body:
{
  "callTypeCode": "MVC",
  "callTypeDescription": "Motor Vehicle Crash",
  "priorityCode": "1",
  "locationAddress": "I-26 and US-78",
  "locationCity": "North Charleston",
  "locationState": "SC",
  "locationCounty": "Charleston",
  "gisLatitude": 32.868,
  "gisLongitude": -79.986,
  "callerName": "Berkeley County 911",
  "callerPhone": "+18432555000",
  "externalSource": "RAPID_CORTEX_C2C",
  "externalIncidentId": "2026-BERK-001234",
  "externalAgencyName": "Berkeley County ECC",
  "dispatcherNotes": "Cross-county mutual aid request. Berkeley County has units responding."
}

Expected response: 201 Created
{
  "incidentNumber": "2026-CC-001235",
  ...rest of incident
}
```

**Questions for CentralSquare:**
- Is this available in the CS Open Platform or requires Unify licensing?
- What field designates the incident as an external/C2C source?
- Does it appear as a "pending" incident in the CS Enterprise dispatcher console?
- What fields are required minimum vs optional?
- Are there any field length or format constraints not obvious from the spec?

---

### 4. Update incident

```
PATCH /cs-enterprise/api/v1/incidents/{incidentNumber}
Authorization: Bearer {access_token}
Body: partial incident (only changed fields)
```

---

### 5. Close incident

```
POST /cs-enterprise/api/v1/incidents/{incidentNumber}/close
Authorization: Bearer {access_token}
Body: { "dispositionCode": "CLR", "closeNotes": "..." }
```

---

### 6. Record external dispatch confirmation

When Berkeley or Dorchester dispatches in response to a Charleston County
transfer request, we push the confirmation back into CS Enterprise.

```
POST /cs-enterprise/api/v1/incidents/{incidentNumber}/external-update
Authorization: Bearer {access_token}
Body:
{
  "updateType": "DISPATCH_CONFIRMATION",
  "externalAgencyId": "BERK-SC",
  "externalAgencyName": "Berkeley County 911",
  "respondingUnits": [
    {
      "unitId": "BERK-M1",
      "unitType": "MEDIC",
      "status": "EN_ROUTE",
      "estimatedArrivalMinutes": 8
    }
  ],
  "timestamp": "2026-09-17T21:06:00Z"
}
```

---

### 7. Get unit resources

```
GET /cs-enterprise/api/v1/resources
Authorization: Bearer {access_token}
Scope: units:read

Expected response:
[
  {
    "unitId": "CHAS-M1",
    "unitDescription": "Charleston EMS Medic 1",
    "unitType": "MEDIC",
    "currentStatus": "AVAILABLE"
  }
]
```

---

### 8. Get AVL positions

```
GET /cs-enterprise/api/v1/avl/positions
Authorization: Bearer {access_token}
Scope: avl:read

Expected response:
[
  {
    "unitId": "CHAS-M1",
    "latitude": 32.868,
    "longitude": -79.986,
    "heading": 180,
    "speedMph": 0,
    "avlDateTime": "2026-09-17T21:05:30Z",
    "currentStatus": "AVAILABLE"
  }
]
```

---

## Optional (preferred)

### 9. Event stream / webhooks

CS Enterprise's event push mechanism, if available, would eliminate polling.

```
POST /cs-enterprise/api/v1/webhooks
Authorization: Bearer {access_token}
Body:
{
  "callbackUrl": "https://api.rapidcortex.com/c2c/inbound/CHAS-SC",
  "events": [
    "incident.created",
    "incident.updated",
    "incident.closed",
    "unit.status.changed",
    "avl.position.updated"
  ],
  "secret": "{HMAC-SHA256 signing secret}"
}
```

If CS Enterprise uses Server-Sent Events or WebSockets instead of webhooks,
we can accommodate either protocol.

---

## Status code mapping (to be confirmed)

| CS Enterprise Status | APCO Status |
|---|---|
| ? | AVAILABLE |
| ? | DISPATCHED |
| ? | EN_ROUTE |
| ? | ON_SCENE |
| ? | AT_HOSPITAL |
| ? | CLEARED |

---

## CentralSquare Open Platform vs Unify

We understand CentralSquare has a native C2C product (Unify). We're building
our own hub because:
1. It connects to Southern Software agencies (Berkeley + Dorchester) that Unify
   may not cover
2. It uses NENA EIDO standards as the neutral wire format
3. It connects to the Rapid Cortex intelligence platform

We are not competing with Unify. We are building a standards-based hub that
uses CS's published API. If CentralSquare prefers, the hub could be built as a
Unify integration point rather than a direct CAD API integration — we're open
to discussing both paths.

---

## Next steps

1. CentralSquare confirms API availability under Open Platform program
2. CentralSquare provisions OAuth2 client credentials (non-production)
3. Rapid Cortex confirms field names against actual CS API response
4. Integration test in CS sandbox/dev environment
5. Production deployment with Charleston County approval
