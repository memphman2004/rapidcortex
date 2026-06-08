# CAD Vendor Onboarding Checklist

Use this checklist before enabling any real (non-mock) CAD adapter for an agency.

## 1) Agency readiness

- [ ] Agency has approved CAD integration scope.
- [ ] Agency has approved data fields allowed to be read/written.
- [ ] Agency confirms write-back governance contacts (dispatcher lead, supervisor lead, IT/security owner).

## 2) Vendor access prerequisites

- [ ] Vendor API documentation obtained.
- [ ] Sandbox or test environment access provided.
- [ ] Authentication method documented (OAuth, API key, mTLS, etc.).
- [ ] Rate limits and timeout constraints documented.
- [ ] Vendor outage/error contract documented.

## 3) Security prerequisites

- [ ] Secrets stored in approved secret management system.
- [ ] Secrets are never committed to source control.
- [ ] Network allow-list requirements documented.
- [ ] Least-privilege access policy reviewed.
- [ ] Data retention and audit requirements confirmed.

## 4) Field mapping

- [ ] Incident ID mapping documented.
- [ ] Location and geospatial mapping documented.
- [ ] Narrative and disposition mapping documented.
- [ ] Media link handling documented.
- [ ] Agency-specific custom fields mapped and reviewed.

## 5) Write-back controls

- [ ] Read-only mode validated first.
- [ ] Human approval workflow validated.
- [ ] Allowed write-back actions validated:
  - [ ] addNarrativeNote
  - [ ] attachMediaLink
  - [ ] updateDisposition
- [ ] Blocked-by-default actions remain blocked:
  - [ ] dispatchUnit
  - [ ] changePriority
  - [ ] closeIncident
  - [ ] deleteIncident

## 6) Testing

- [ ] Adapter unit tests pass.
- [ ] Factory selection tests pass.
- [ ] Write-back approval tests pass.
- [ ] Error handling tests pass for not-configured and failure paths.
- [ ] Agency acceptance tests completed in sandbox.

## 7) Go-live guardrails

- [ ] `CAD_WRITEBACK_ENABLED` remains false until signoff.
- [ ] Incident communications runbook prepared.
- [ ] Rollback path documented and rehearsed.
- [ ] Monitoring and alerting verified.
- [ ] Final approvals captured from agency + engineering + security.

## 8) Agency feature config PATCH (required — no UI toggle yet)

The entitlement layer (`writeBackEnabled`, `agencyApprovedCadWriteBack`, `cadIntegrationMode`, `auditLoggingEnabled`) is **not** exposed in the admin UI. RC ops must apply it **once per pilot agency** during onboarding, **before** flipping `CAD_WRITEBACK_ENABLED` / `NEXT_PUBLIC_ENABLE_CAD_WRITEBACK`.

**Endpoint:** `PATCH {WEB_ORIGIN}/api/agency/config` (web BFF). The JWT `custom:agencyId` selects the tenant — there is no `/api/agencies/{agencyId}/config` Lambda route. Run as that agency's `agencyadmin` bearer (or RC ops holding that tenant's admin token).

```bash
export PILOT_WEB_BASE="https://app.rapidcortex.us"
export PILOT_AGENCY_ADMIN_BEARER="<agencyadmin_id_token>"

curl -X PATCH "${PILOT_WEB_BASE}/api/agency/config" \
  -H "Authorization: Bearer ${PILOT_AGENCY_ADMIN_BEARER}" \
  -H "Content-Type: application/json" \
  -d '{
    "cadIntegrationMode": "assisted_writeback",
    "writeBackEnabled": true,
    "agencyApprovedCadWriteBack": true,
    "auditLoggingEnabled": true
  }'
```

Then enable deploy env (API + web):

```bash
CAD_WRITEBACK_ENABLED=true
NEXT_PUBLIC_ENABLE_CAD_WRITEBACK=1
```

## 9) Automated smoke (supervisor approval queue)

After env flip, validate the full write-back path with `scripts/pilot-smoke-test.ts` (not manual curl):

```bash
export PILOT_API_BASE="https://<api-gateway-url>"
export PILOT_CAD_WRITEBACK_E2E=1
export PILOT_DISPATCHER_BEARER_TOKEN="<dispatcher_jwt>"
export PILOT_SUPERVISOR_BEARER_TOKEN="<supervisor_jwt>"
export PILOT_WRITEBACK_INCIDENT_ID="<incident-with-cadIncidentId>"

npx tsx scripts/pilot-smoke-test.ts
```

**Preflight (automated in smoke):**

- `PILOT_WRITEBACK_INCIDENT_ID` must resolve to an incident with `cadIncidentId` populated (CAD read-only adapter polled and matched). Otherwise the test fails with **incident has no CAD counterpart** before submit.
- `PILOT_DISPATCHER_BEARER_TOKEN` and `PILOT_SUPERVISOR_BEARER_TOKEN` must decode to **different** JWT `sub` values. Same user fails immediately — supervisor cannot approve own submission.

Expected sequence: dispatcher submit → `pending_approval` (202) → supervisor lists queue → supervisor approves → audit row leaves pending (approved or failed if vendor mock rejects — both prove the queue wiring).
