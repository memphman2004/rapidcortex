# Cybersecurity controls (RFP)

**Scope:** Rapid Cortex cloud SaaS (web + API on AWS). Assistive intelligence for emergency communications — does **not** replace CAD, 911 telephony, radio, or medical direction.  
**Claim level:** CJIS-**aligned** technical controls. **Not** CJIS, SOC 2, HIPAA, or FedRAMP certification.

How to use in a proposal: [README.md](./README.md).

---

## 1. CJIS-aligned security controls

Rapid Cortex is designed so an agency CJIS Information Security Officer can **map** product controls to the CJIS Security Policy. The agency completes its own authorization path (personnel, physical, and local policy). Rapid Cortex does not issue FBI approval.

| CJIS-oriented area | Rapid Cortex control | Evidence |
|--------------------|----------------------|----------|
| Identification & authentication | AWS Cognito user pool; JWT verified server-side; MFA (software TOTP) configurable as agency policy | [AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md), [CJIS_ALIGNMENT_NOTES.md](../security-compliance/CJIS_ALIGNMENT_NOTES.md) |
| Access control | Canonical roles in JWT `custom:role`; `AuthorizationService.canPerform()`; `agencyId` on every DynamoDB access | `packages/security`, [TENANT_ISOLATION_MODEL.md](../security-compliance/TENANT_ISOLATION_MODEL.md) |
| Audit & accountability | Append-only audit events for meaningful mutations; CloudWatch application logs (no raw transcripts / secrets by policy) | [AUDIT_EVENT_MATRIX.md](../security-compliance/AUDIT_EVENT_MATRIX.md) |
| Identification of inactive users | `custom:status` must be active for API access | Auth gate |
| Encryption in transit | TLS 1.2+ (browser, API Gateway / CloudFront, AWS service calls) | [SECURITY_MODEL.md](../security-compliance/SECURITY_MODEL.md) |
| Encryption at rest | DynamoDB and S3 AWS-managed encryption; KMS CMK upgrade path per agency policy | SAM templates |
| Configuration management | Infrastructure as code (SAM / CloudFormation); secrets by ARN, never in git | [CI_RELEASE_PIPELINE.md](../deployment-infrastructure/CI_RELEASE_PIPELINE.md) |
| Media | Private S3, short-lived retrieval where configured | Media services |
| Human-in-the-loop | AI is decision support; CAD write-back **off** unless explicitly enabled and contracted | Feature-flag policy |

**Agency still owns:** background checks, security awareness training, physical PSAP controls, CJIS Security Addendum execution, and mapping of Rapid Cortex as a contractor system.

**CJIS-sensitive mode (config):** prefer AWS-native AI/STT/Translate only; leave external OpenAI/Anthropic secret ARNs unset. Confirm in the SOW before treating a tenant as CJIS-sensitive.

---

## 2. Multi-layer cybersecurity architecture

Defense is layered. Compromise of one layer does not grant tenant-wide data access.

```
Internet
  → CloudFront + AWS WAF (edge: managed rules, reputation, rate limit)
    → Application Load Balancer / API Gateway
      → Cognito JWT authorizer + application RBAC + tenant guard
        → Lambda IAM roles (least privilege per function)
          → DynamoDB / S3 (encrypted) keyed by agencyId
            → Secrets Manager (provider keys by ARN)
```

| Layer | Function |
|-------|----------|
| **Edge** | TLS, WAF common/bad-input/reputation rules, per-IP rate limit |
| **Identity** | Cognito, MFA-capable, session cookies httpOnly where auth proxy is used |
| **Application** | Role matrix, tenant isolation, Zod validation, CSRF/origin checks on cookie writes |
| **Data** | Partition by `agencyId`; no URL-slug security boundary |
| **Secrets** | Secrets Manager; no production keys in repo or `NEXT_PUBLIC_*` except public Cognito ids |
| **Deception (optional)** | Honeypot/decoy routes + honeytokens; telemetry only, not IPS |
| **Ops** | CloudWatch metrics/alarms, SNS ops topic, structured logs |

Trust zones: [SECURITY_MODEL.md](../security-compliance/SECURITY_MODEL.md).

---

## 3. Security operations (SOC) monitoring

Rapid Cortex provides **platform security operations** on AWS — not a customer-owned SOC floor and not a default 24/7 human watch center.

### What ships

| Capability | Mechanism | Operator action |
|------------|-----------|-----------------|
| Availability & error monitoring | CloudWatch dashboard `rapid-cortex-<stage>-ops`; API 4xx/5xx, Lambda errors/throttles, DynamoDB user errors | Subscribe `OpsAlertsTopic` |
| Voice/AI pipeline | Custom metric `PipelineHardFailures` | Alarm → SNS |
| Auth / abuse signals | Cognito events; WAF blocked/counted requests; CSP reports | Review spikes |
| Application audit | DynamoDB audit table; Admin → Audit | Agency-scoped |
| Deception telemetry | DeceptionEvents + CloudWatch (if enabled) | RC admin / IT admin review |
| Synthetic liveness | `GET /api/health`; `scripts/synthetic-api-health.sh` | Schedule in operator CI |

Procedures: [MONITORING_AND_OPS.md](../operations-runbooks/MONITORING_AND_OPS.md).

### SOC operating model (standard vs upgraded)

| Mode | Coverage | How to buy / staff |
|------|----------|--------------------|
| **Standard (included)** | CloudWatch + SNS; business-hours Rapid Cortex engineering on-call per [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md) | Default |
| **24/7 incident support** | Dedicated on-call Rapid Cortex engineer under contracted SLA | Add-on `reliability.support_upgrade_247` |
| **SIEM / agency SOC feed** | Export/connector to the agency’s SIEM or NOC | Add-on `reliability.siem_connector` (or equivalent SOW) |

**Do not** describe the standard SKU as “we run a SOC.” Describe it as “AWS-native monitoring, alerting, and documented incident response, with optional 24/7 on-call and SIEM integration.”

Account-level GuardDuty / Security Hub / AWS Config: recommended for production accounts ([PRODUCTION_SECURITY_CHECKLIST.md](../security-compliance/PRODUCTION_SECURITY_CHECKLIST.md)); enable via the security-hardening stack when the account owner approves cost and finding routing.

---

## 4. Intrusion detection and prevention

| Control | Detect | Prevent / respond |
|---------|--------|-------------------|
| **AWS WAF** | SQLi/XSS-class probes (managed rule groups), known-bad inputs, Amazon IP reputation, volumetric per-IP floods | Block or count; tune `WafRateLimitPer5Min` |
| **API authorizer + RBAC** | Unauthenticated or wrong-role calls | 401/403; optional `authz.access_denied` audit |
| **Deception Shield** | Scanner hits on decoy CAD/NCIC/secrets paths; honeytoken use | Alert / log; **auto-block is not wired** — do not claim IPS |
| **GuardDuty** (account option) | Cloud/API threat findings | SNS on HIGH/CRITICAL when detector is enabled |
| **Cognito** | Credential stuffing / lockout (pool advanced security where enabled) | Challenge, lock, disable user |

WAF evidence notes: [g3-waf-proof.md](../security/g3-waf-proof.md). Deception: [DECEPTION_SHIELD.md](../security/DECEPTION_SHIELD.md).

This is **cloud application** IDS/IPS-equivalent, not a network TAP or NGFW on the agency LAN.

---

## 5. Network segmentation

Rapid Cortex is multi-tenant **SaaS**. Segmentation is applied in AWS and in the data model — not by installing VLANs in the PSAP.

| Boundary | How it is enforced |
|----------|-------------------|
| Public internet → app | CloudFront / WAF / TLS; approved CORS origins only in non-dev |
| Web SSR | ECS/Fargate in VPC behind ALB |
| API | API Gateway + Lambda; function IAM cannot reach other tenants’ keys |
| Data | DynamoDB `agencyId` partition; `rcsuperadmin` is the only cross-tenant platform role and is audited |
| Secrets | Per-secret IAM `GetSecretValue` on named ARNs |
| Agency LAN | **Agency IT.** Rapid Cortex users reach the SaaS over HTTPS; CAD/radio stay on agency networks |

**Agency responsibility:** segment CAD, logging recorders, and 911 CPE from general office VLANs per local policy. Rapid Cortex does not require inbound connections from the cloud into the CAD VLAN for the default assistive (read-side / no write-back) posture.

Draw the **agency-specific** access path (workstations → Rapid Cortex URL, optional CAD interface) in the implementation workbook. Do not reuse a generic diagram as if it were that site’s network.

---

## 6. Identity and access management

| Control | Implementation |
|---------|----------------|
| Identity provider | AWS Cognito User Pool |
| Tokens | JWT (`custom:role`, `custom:agencyId`, `custom:status`); verified with JWKS |
| Roles | Canonical strings only (`dispatcher`, `supervisor`, `agencyadmin`, …). Deprecated `commsupervisor` is not used |
| Authorization | `packages/security` `AuthorizationService` at handler entry; UI omits forbidden actions rather than greying them |
| MFA | Software TOTP; agency policy can require it for privileged roles |
| Session | httpOnly cookies when auth proxy is on; no long-lived user API keys in the browser |
| Service identity | Per-Lambda IAM roles; no human keys in git |
| Privileged platform access | `rcsuperadmin` / `rcadmin` / `rcitadmin` only on RC Admin; cross-tenant access logged |
| Provisioning | Agency admin creates users; inactive/disabled status denies API access |
| QR / locations | Restricted to campus/venue roles; PSAP roles excluded |

Procedures: [USER_PROVISIONING_GUIDE.md](../admin-user-management/USER_PROVISIONING_GUIDE.md), [ROLE_MAPPING_GUIDE.md](../product-architecture/ROLE_MAPPING_GUIDE.md).

Access reviews: agency IT reviews active Cognito users at least **quarterly**; Rapid Cortex reviews platform-operator accounts on the same cadence.

---

## 7. Security event logging and monitoring

### Application audit (tenant-visible)

Meaningful state changes emit audit events (`incident.created`, `analysis.created`, `admin.user.create`, …). Admin → Audit lists newest-first, server-redacted. Matrix: [AUDIT_EVENT_MATRIX.md](../security-compliance/AUDIT_EVENT_MATRIX.md).

### Platform logs (operator)

| Source | Use | Policy |
|--------|-----|--------|
| CloudWatch Logs (Lambda, ECS) | Debugging, IR | No JWT, passwords, raw transcripts, or CAD payloads |
| API Gateway / ALB access logs | Request tracing (`requestId`) | Enable for production |
| CloudTrail | AWS API accountability | Recommended org/account trail + integrity; confirm per account |
| WAF logs | Edge blocks and counts | Review on incident |
| SNS ops topic | Alarm delivery | Must have a subscription or alerts are silent |

Retention: CloudWatch log groups use stage-defined `RetentionInDays` in SAM. Agency records-retention for **incident content** is separate ([PRIVACY_RETENTION_DECISIONS.md](../security-compliance/PRIVACY_RETENTION_DECISIONS.md)).

Monitoring runbook: [MONITORING_AND_OPS.md](../operations-runbooks/MONITORING_AND_OPS.md).

---

## 8. Vulnerability management

**Process (continuous):**

1. **Develop** — PR review; TypeScript strict; Zod at API boundaries; lockfiles committed.  
2. **Build** — `npm ci`, `npm run typecheck`, `npm run build`, `npm test`.  
3. **Scan** — `npm audit --audit-level=moderate`; `npm run validate:iam`; secret scan (`npm run security:scan-secrets` where configured).  
4. **Optional (operator CI)** — Checkov on `infra/`, Trivy, Semgrep (`.semgrep/security.yml`), CodeQL. This repo does not ship GitHub Actions; operators attach these gates in their pipeline ([CI_RELEASE_PIPELINE.md](../deployment-infrastructure/CI_RELEASE_PIPELINE.md)).  
5. **Patch** — Critical/high dependency findings: target **14 days**; medium **30 days**; or documented risk acceptance by Rapid Cortex security owner.  
6. **Infrastructure** — SAM/CloudFormation diffs reviewed; no wildcard IAM for fine-grained services on new statements.  
7. **Pen test** — Third-party application pen test by **separate SOW** before a production CJIS-sensitive claim. Not bundled in the base SKU.  
8. **Disclosure** — Security issues to Rapid Cortex security contact; no public zero-day detail until patched.

**Cadence:** dependency audit on every release candidate; IAM validate on template changes; formal review of open `npm audit` items monthly.

---

## 9. Incident response procedures

An **incident** here is an operational or security event affecting Rapid Cortex (outage, suspected breach, auth anomaly) — not a 911 call record.

| Severity | Examples | First actions |
|----------|----------|----------------|
| **SEV-1** | Platform-wide outage, confirmed data exposure, mass credential leak | Page on-call; freeze deploys; start evidence timeline; notify agency sponsor immediately |
| **SEV-2** | One major path down, WAF/auth spike, elevated 5xx | Owner in 30 minutes; agency channel update |
| **SEV-3** | Single user, suspected one account | Disable user, revoke sessions, ticket |

**Security containment**

1. Disable compromised Cognito user; revoke refresh tokens.  
2. Rotate leaked secrets in Secrets Manager; redeploy if env ARNs change.  
3. Confirm S3 Block Public Access; query CloudTrail on policy changes.  
4. Preserve CloudWatch, access logs, audit export — **do not** paste transcripts or PII into tickets.

**Comms:** SEV-1 internal updates at least every 30 minutes until stable; agency-facing updates only from approved contacts; post-incident summary to sponsor within 24–48 hours for SEV-1/2.

Full procedures: [INCIDENT_RESPONSE.md](../operations-runbooks/INCIDENT_RESPONSE.md), [INCIDENT_RESPONSE_RUNBOOK.md](../operations-runbooks/INCIDENT_RESPONSE_RUNBOOK.md), [ESCALATION_PATHS.md](../operations-runbooks/ESCALATION_PATHS.md).  
Breach notification timelines: executed DPA / MSA — not this file.

Tabletop: Rapid Cortex runs an IR tabletop at least **annually** and after material architecture change; record date in the agency playbook if they participate.

---

## 10. Disaster recovery procedures

| Asset | Recovery method | Notes |
|-------|-----------------|-------|
| Application (API) | Redeploy last known-good SAM artifact / git tag | CloudFormation auto-rollback on failed updates |
| Web (ECS) | Redeploy prior task definition; CloudFront invalidation if needed | Target: API ≤ 30 min, web ≤ 60 min (internal ops target, not an SLA unless Exhibit C says so) |
| DynamoDB | Point-in-time recovery **on** for staging / prod / pilot | Restore to **new** tables, validate, then cut over |
| S3 assets | Versioning recommended for evidentiary media (not baseline on every bucket) | Enable when the SOW requires non-replaceable media |
| Secrets | Secrets Manager + operator primary store | Values are not recoverable from git |
| Cognito | AWS account recovery procedures; export pool ids from stack outputs | No PITR on the user pool — plan federation or export |

**Pilot / production targets (propose in SOW; do not imply they are already guaranteed):**

| Metric | Proposed production | Pilot default |
|--------|---------------------|---------------|
| RPO | ≤ 1 hour (DynamoDB PITR) | PITR on; no contractual RPO unless signed |
| RTO (app) | ≤ 4 hours | Best effort + rollback runbook |
| Restore drill | Before production SLA claims | Schedule within 30 days of go-live |

Restore drill steps: [BACKUP_AND_RECOVERY.md](../operations-runbooks/BACKUP_AND_RECOVERY.md). Floor continuity if Rapid Cortex is down: dispatchers use CAD/radio/911 as today ([NON_GOALS.md](../go-to-market-sales/NON_GOALS.md)).

---

## Related

- [SECURITY_QUESTIONNAIRE_RESPONSES.md](../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md)  
- [SUBPROCESSOR_LIST.md](../security-compliance/SUBPROCESSOR_LIST.md)  
- [implementation-and-transition.md](./implementation-and-transition.md)
