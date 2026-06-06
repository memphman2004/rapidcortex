# Rapid Cortex CAD Connection Playbook

This playbook provides a strict, step-by-step, implementation-oriented guide for connecting Rapid Cortex to an agency CAD environment during pilot and production rollout.

Rapid Cortex does **not** replace CAD. Rapid Cortex augments existing CAD operations with AI-assisted transcription, triage support, summarization, translation, QA scoring, and responder context.

Important scope statement:

- CAD integration in this repository is **not** currently turnkey/productized for all vendors.
- Every agency/vendor environment requires discovery, vendor coordination, sandbox testing, security review, and staged rollout.
- Do not claim complete live CAD support unless your implemented adapter and agency validation prove it.
- Use “CJIS-aligned controls” where applicable; do **not** claim CJIS certification unless formally completed.

## 1. Integration Goal

The goal is to connect Rapid Cortex to CAD in controlled phases:

1. **Read-only / shadow mode**
2. **Dispatcher-reviewed recommendations**
3. **Optional CAD write-back**
4. **Production monitored operation**

## 1.1 Code layer (this repo)

- **Adapter resolution**: `apps/web/lib/rapid-cortex/cad/CadAdapterFactory.ts` (`resolveCadAdapter`) defaults to `DisabledCadAdapter`, then `ReadOnlyCadAdapter` when `CAD_INTEGRATION_MODE=read_only`.
- **Environment** variables are documented in deployment guides; **never** expose CAD secrets to the browser.
- In-app and API responses should say **“CAD integration configuration required”** when required env is missing, not that live CAD is working.

## 2. CAD Integration Modes

| Mode                          | Description                                                                                                                | Risk profile                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **No CAD integration**        | Rapid Cortex runs beside CAD; dispatcher manually copies approved summaries into CAD.                                      | Lowest risk                             |
| **Read-only CAD integration** | Rapid Cortex reads incident/call metadata from CAD; no CAD updates are sent.                                               | Best for pilots                         |
| **Assisted write-back**       | Rapid Cortex drafts updates; dispatcher explicitly approves before CAD update.                                             | Recommended first production write mode |
| **Automated write-back**      | System writes approved fields automatically. Requires strict agency approval, audit logs, rollback, and vendor validation. | Not recommended for early pilots        |

## 3. Prerequisites

### Agency checklist

- [ ] CAD vendor name
- [ ] CAD version
- [ ] CAD deployment model: cloud, hosted, or on-prem
- [ ] CAD technical contact
- [ ] Agency IT contact
- [ ] Security/CJIS contact
- [ ] Network/firewall contact
- [ ] Test/sandbox CAD environment availability
- [ ] Approved integration method

### Technical checklist

- [ ] CAD API documentation or vendor integration guide
- [ ] Sandbox/test credentials
- [ ] VPN/private network requirements
- [ ] IP allowlist requirements
- [ ] Auth method: API key, OAuth, SAML, mTLS, service account, certificate
- [ ] Supported protocol: REST, SOAP, message queue, database view, file drop, webhook, vendor SDK
- [ ] Allowed read fields
- [ ] Allowed write fields
- [ ] Rate limits
- [ ] Audit log requirements
- [ ] Data retention requirements

### Rapid Cortex checklist

- [ ] API base URL
- [ ] Environment name: dev/stage/prod
- [ ] Cognito configuration
- [ ] Secrets Manager access
- [ ] CloudWatch logging enabled
- [ ] Audit logging enabled
- [ ] Rollback plan created

## 4. Discovery Phase

Step-by-step:

1. Identify CAD vendor and deployment model.
2. Request official CAD integration documentation.
3. Confirm whether the agency has a sandbox CAD environment.
4. Identify allowed integration method.
5. Identify fields Rapid Cortex may read.
6. Identify fields Rapid Cortex may write.
7. Confirm security requirements.
8. Confirm audit/logging requirements.
9. Confirm approval process for go-live.

### Discovery Questions for CAD Vendor

- [ ] Do you provide REST/SOAP APIs?
- [ ] Do you support webhooks/event streams?
- [ ] Do you support incident creation through API?
- [ ] Do you support incident note updates?
- [ ] Do you support unit/status updates?
- [ ] Do you support read-only access?
- [ ] Do you support sandbox credentials?
- [ ] What authentication methods are required?
- [ ] What fields are required to create or update an incident?
- [ ] What are the rate limits?
- [ ] What logging/audit requirements apply?
- [ ] Are there existing certified third-party integration patterns?

## 5. Recommended Pilot Architecture

Recommended first pilot:

`Caller audio/transcript -> Rapid Cortex AI processing -> AI summary/triage/recommendation -> dispatcher review -> optional manual copy into CAD`

Next stage:

`CAD read-only feed -> Rapid Cortex displays incident/call metadata -> AI enriches context -> dispatcher reviews -> no CAD write-back`

Final stage:

`Dispatcher-approved write-back -> Rapid Cortex sends approved note/update to CAD -> CAD confirms success/failure -> Rapid Cortex stores audit record`

## 6. Environment Variables

Suggested placeholders:

```bash
CAD_VENDOR_NAME=
CAD_INTEGRATION_MODE=disabled|read_only|assisted_writeback|automated_writeback
CAD_API_BASE_URL=
CAD_AUTH_TYPE=api_key|oauth2|mtls|basic|vendor_sdk
CAD_API_KEY_SECRET_ARN=
CAD_CLIENT_ID_SECRET_ARN=
CAD_CLIENT_SECRET_SECRET_ARN=
CAD_CERT_SECRET_ARN=
CAD_ALLOWED_READ_FIELDS=
CAD_ALLOWED_WRITE_FIELDS=
CAD_WRITEBACK_ENABLED=false
CAD_SANDBOX_MODE=true
CAD_TIMEOUT_MS=5000
CAD_MAX_RETRIES=2
```

| Variable                       | Purpose                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `CAD_VENDOR_NAME`              | Vendor identifier for routing and diagnostics (for example Motorola, Tyler, Hexagon).         |
| `CAD_INTEGRATION_MODE`         | Integration mode gate (`disabled`, `read_only`, `assisted_writeback`, `automated_writeback`). |
| `CAD_API_BASE_URL`             | Base URL for CAD API/service endpoint (sandbox or production).                                |
| `CAD_AUTH_TYPE`                | Authentication path used by adapter (`api_key`, `oauth2`, `mtls`, `basic`, `vendor_sdk`).     |
| `CAD_API_KEY_SECRET_ARN`       | Secrets Manager ARN for API key-based auth.                                                   |
| `CAD_CLIENT_ID_SECRET_ARN`     | Secrets Manager ARN for OAuth client id or equivalent identity value.                         |
| `CAD_CLIENT_SECRET_SECRET_ARN` | Secrets Manager ARN for OAuth client secret or equivalent confidential token.                 |
| `CAD_CERT_SECRET_ARN`          | Secrets Manager ARN for client certificate material for mTLS/cert flows.                      |
| `CAD_ALLOWED_READ_FIELDS`      | Comma-separated allowlist of CAD fields Rapid Cortex may ingest.                              |
| `CAD_ALLOWED_WRITE_FIELDS`     | Comma-separated allowlist of fields Rapid Cortex may submit to CAD.                           |
| `CAD_WRITEBACK_ENABLED`        | Safety flag for all write paths; keep `false` until explicit approval.                        |
| `CAD_SANDBOX_MODE`             | Marks adapter runtime as sandbox/test mode.                                                   |
| `CAD_TIMEOUT_MS`               | CAD request timeout to avoid blocking dispatcher workflows.                                   |
| `CAD_MAX_RETRIES`              | Max retry count for transient integration errors.                                             |

## 7. Adapter Design

Use a vendor-neutral adapter interface at the core workflow boundary.

```ts
interface CadAdapter {
  healthCheck(): Promise<CadHealthResult>;
  getIncident(incidentId: string): Promise<CadIncident>;
  searchIncidents(query: CadSearchQuery): Promise<CadIncident[]>;
  createDraftUpdate(input: CadDraftUpdateInput): Promise<CadDraftUpdate>;
  submitApprovedUpdate(input: CadApprovedUpdateInput): Promise<CadWriteResult>;
}
```

Design rules:

- Each CAD vendor gets its own adapter implementation.
- Core Rapid Cortex workflow calls the generic adapter interface.
- Vendor-specific logic must not be scattered across web/API surfaces.
- Write-back must be disabled by default.

## 8. Read-Only Integration Steps

1. Confirm sandbox access.
2. Store CAD credentials in AWS Secrets Manager.
3. Configure env vars.
4. Add agency/vendor adapter.
5. Run adapter health check.
6. Pull test incident from sandbox.
7. Validate field mapping.
8. Confirm no write endpoints are enabled.
9. Log read-only access events.
10. Perform dispatcher shadow testing.
11. Document discrepancies.
12. Obtain agency approval before moving to assisted write-back.

## 9. Assisted Write-Back Steps

1. Keep `CAD_WRITEBACK_ENABLED=false` initially.
2. Define allowed write fields.
3. Confirm required CAD fields.
4. Create draft CAD update from Rapid Cortex summary.
5. Show draft to dispatcher.
6. Require explicit dispatcher approval.
7. Submit approved update to CAD sandbox.
8. Capture CAD response.
9. Store audit log with user, timestamp, incident ID, before/after fields, AI source, and dispatcher approval.
10. Test validation failures.
11. Test timeout failures.
12. Test duplicate submission prevention.
13. Test rollback/manual correction process.
14. Obtain written approval before production.

## 10. Validation Checklist

- [ ] CAD health check succeeds
- [ ] CAD health check fails safely
- [ ] Invalid credentials fail safely
- [ ] Read-only mode cannot write
- [ ] Write-back disabled blocks all write attempts
- [ ] Dispatcher approval required
- [ ] CAD timeout does not freeze Rapid Cortex UI
- [ ] Failed write-back is visible to dispatcher
- [ ] Audit log created for every attempt
- [ ] Duplicate write-back prevented
- [ ] Sensitive data is not logged unnecessarily
- [ ] Production secrets are not exposed to frontend
- [ ] Rollback plan tested

## 11. Rollback Plan

If issues appear during pilot or production:

1. Disable `CAD_WRITEBACK_ENABLED`.
2. Set `CAD_INTEGRATION_MODE=read_only` or `disabled`.
3. Revoke CAD API key/cert if needed.
4. Confirm no queued write-backs remain.
5. Notify agency IT and dispatch supervisor.
6. Continue using Rapid Cortex in no-CAD or shadow mode.

## 12. Security and Compliance Notes

- Use least-privilege CAD access.
- Keep separate sandbox and production credentials.
- Do not place CAD credentials in frontend code.
- Store secrets in AWS Secrets Manager.
- Capture audit logging for every read/write attempt.
- Align data retention with agency requirements.
- Complete CJIS-aligned deployment review where applicable.
- Do not claim CJIS certification unless formally completed.

## 13. Motorola / Vendor Engagement Checklist

- [ ] Request CAD API/integration guide
- [ ] Request sandbox environment
- [ ] Request sample incident payloads
- [ ] Request authentication requirements
- [ ] Request approved field mapping
- [ ] Request rate limit documentation
- [ ] Request test plan requirements
- [ ] Request production cutover requirements
- [ ] Request support/escalation contacts

## 14. Deliverables for Each Agency

- [ ] Completed CAD discovery worksheet
- [ ] Network diagram
- [ ] Auth/security approval
- [ ] Field mapping document
- [ ] Sandbox test results
- [ ] Read-only test signoff
- [ ] Assisted write-back test signoff
- [ ] Rollback plan
- [ ] Production go/no-go approval

## 15. Related Docs

- [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)
- [INSTALLATION.md](./INSTALLATION.md)
- [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md)
