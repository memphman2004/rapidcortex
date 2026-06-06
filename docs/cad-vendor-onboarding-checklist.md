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
