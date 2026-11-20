# NexCort iQ K–12 — Security & Privacy

**Product:** NexCort iQ Campus (K–12)  
**Last updated:** November 2026

---

## Governing Laws & Frameworks

| Law / Framework | Applicability | NexCort iQ Role |
|-----------------|--------------|-----------------|
| **FERPA** (20 U.S.C. §1232g) | All student education records | Operator / service provider under school official exception; district is covered entity |
| **COPPA** (Children's Online Privacy Protection Act) | Features directly accessible by students under 13 | No NexCort iQ feature is designed for direct student use; anonymous reporting has no login |
| **CIPA** (Children's Internet Protection Act) | Internet filtering on school devices | Out of scope; NexCort iQ is a staff/safety tool, not a student device management system |
| **SOPIPA** (Student Online Personal Info Protection Act — CA) | Collection / sale of student data for non-educational purposes | NexCort iQ does not sell or profile student data; complies with SOPIPA requirements |
| **State student privacy laws** | Varies by state | Agency must review; NexCort iQ provides controls but compliance is district-managed |
| **CJIS Security Policy** | Criminal justice information | Campus NexCort iQ does NOT process CJIS data; NSOPW is a public (non-CJIS) registry |
| **HIPAA** | Protected health information | School nurse / medical records are out of scope Phase 1; not stored in NexCort iQ |

**NexCort iQ is a software service provider acting under FERPA's "school official" exception.** The school district is the data controller. NexCort iQ processes student data only as directed by the district in an executed Data Processing Agreement (DPA).

---

## Data Classification

| Data Type | Classification | Stored in | Encryption | Retention |
|-----------|---------------|-----------|-----------|-----------|
| Student name, grade, ID | FERPA-protected PII | DynamoDB (pickup auth table) | AES-256 at rest (AWS KMS) | Per DPA |
| Guardian name + phone | FERPA-related PII | DynamoDB (pickup auth table) | AES-256 at rest | Per DPA |
| Visitor name + ID type | PII (non-student) | DynamoDB (visitors table) | AES-256 at rest | Configurable |
| Visitor phone number | PII | DynamoDB (SHA-256 hash only) | Hashed; never plaintext | With visit record |
| Visitor photo | PII | S3 (agency-scoped prefix) | SSE-S3 or SSE-KMS | Per DPA |
| Incident descriptions | Potentially FERPA if student-linked | DynamoDB (incidents table) | AES-256 at rest | Per DPA |
| NSOPW match results | Sensitive (non-student) | DynamoDB (visit record) | AES-256 at rest | With visit record |
| Anonymous report content | No PII collected | DynamoDB (incidents table) | AES-256 at rest | Per DPA |
| Reporter SMS phone | PII | DynamoDB (SHA-256 hash) | Hashed only | With incident |
| Counselor notes | FERPA + professional privilege | DynamoDB (incidents table) | AES-256 at rest | Per DPA |
| BTAM case records | Most sensitive (Phase 2) | DynamoDB (BTAM table) | AES-256 at rest | Per DPA |
| Camera feeds (KVS) | Operational video | KVS (AWS managed) | TLS in transit | 7-day default |

---

## Tenant Isolation

Every DynamoDB operation uses `agencyId` in the partition key:

```typescript
// Correct — agencyId from verified JWT
const agencyId = user.agencyId; // NEVER from URL params
await ddb.put({ pk: `AGENCY#${agencyId}`, sk: `VISIT#${dateKey}#${id}`, ... });
```

No cross-tenant query is possible in the application layer. `rcsuperadmin` is the only role with cross-tenant access, and that access is audited.

---

## Authentication & Session Security

| Control | Implementation |
|---------|---------------|
| Authentication | AWS Cognito; JWT RS256 |
| Token validation | API Gateway JWT authorizer; validates signature, `iss`, `aud` |
| Session expiration | Cognito access token: 1 hour; refresh token: 30 days |
| MFA | Configurable per User Pool; district IT responsibility |
| Role in token | `custom:role = campus_*_k12`; `custom:agencyId` |
| Role normalization | `normalizeSessionRole()` preserves campus_*_k12 before PSAP migration |
| Inactive account block | `isUserAccountActive()` checked at handler entry; `ACCOUNT_INACTIVE_MESSAGE` returned |

---

## Authorization (RBAC)

Authorization uses `AuthorizationService.canPerform()` from `packages/security`. Role string comparisons are never used directly in handlers.

Campus-specific access check:

```typescript
// campus-access.ts
export function canAccessCampusTenant(user: UserContext, campusCode: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  const agencyId = user.agencyId ?? "";
  return campusCodeFromAgencyId(agencyId) === normalizeCampusCode(campusCode);
}
```

**Principle of least privilege:**
- Faculty role: read-only pickup authorization; no incident creation on behalf of others
- Counselor role: wellness incidents only; no cross-role incident view
- Security role: incident creation, camera access; no user management
- Supervisor role: all operational data; no user provisioning
- Admin role: full access including user management and settings

---

## Audit Logging

Every meaningful state change emits an audit event via `AuditRepository` + `AUDIT_EVENT_TYPES`:

| Event | When |
|-------|------|
| `VISITOR_CHECKED_IN` | Each visitor check-in |
| `NSOPW_CHECKED` | Each NSOPW API call result |
| `VISITOR_FLAGGED` | When NSOPW returns matches |
| `INCIDENT_CREATED` | Each new campus incident |
| `INCIDENT_UPDATED` | Status changes, assignments |
| `INCIDENT_ESCALATED` | Escalation to law enforcement/admin |
| `SILENT_PANIC_ACTIVATED` | Silent panic button press |
| `THREAT_LEVEL_CHANGED` | Threat level update |
| `PICKUP_AUTH_UPDATED` | Changes to authorized pickup list |
| `BROADCAST_SENT` | Emergency broadcast |

Audit logs:
- Never log JWT tokens, PII fields, or CAD data
- Stored in DynamoDB with `AUDIT#` PK prefix via `AuditRepository`
- Access: `auditor` role (PSAP); campus audit access is role-scoped within campus vertical

---

## Student Data Rules

These rules are **absolute** — no feature may violate them:

1. **Never deny access automatically based on AI output.** An AI-generated name match, a fuzzy NSOPW match, or a behavioral AI score cannot autonomously deny a person entry or trigger an adverse action. Human staff decide.

2. **Never link student records to incident outcomes without human review.** If a student is associated with an incident (e.g., victim, subject of welfare check), that association must be manually confirmed by an authorized staff member.

3. **AI must not independently identify suspects, determine guilt, or assess threat level.** AI suggestions are advisory only; all BTAM and incident determinations require human TAT member input.

4. **Student PII must not leave the tenant's AWS region without explicit authorization.** Cross-region replication is not configured for campus tables.

5. **Anonymous reports remain anonymous.** The platform hashes reporter phone numbers and never reveals the reporter's identity to campus staff (only to law enforcement under a valid legal process, which requires a data request to NexCort iQ, not a platform feature).

---

## NSOPW Privacy Notes

- NSOPW is a **public** federal registry; querying it is not a background check and does not involve FERPA or CJIS data
- NexCort iQ sends only visitor first name + last name + (optionally) state to NSOPW
- No student data, school name, or staff data is transmitted to NSOPW
- NSOPW match results are stored internally only; never shared with the visitor

---

## Data Processing Agreement (DPA)

Before processing student data for a K-12 district, a signed DPA must be on file covering:
- Student data categories that may be processed
- Purpose limitation (school safety only)
- Sub-processor list (AWS services used)
- Data return / deletion timeline on contract termination
- Incident notification timeline (72 hours for data breach)
- State-specific addenda (CA, NY, TX requirements)

The DPA is managed by the NexCort iQ legal team. No K-12 district tenant should go live without a signed DPA.

---

## Incident Response

| Scenario | Response |
|----------|---------|
| Unauthorized access to student records | Isolate agencyId, revoke affected Cognito tokens, notify district, assess scope, report to district within 72 hours |
| NSOPW API exposure (accidental visitor PII log) | Remove from CloudWatch logs, audit access, notify district |
| Stolen visitor photo from S3 | Invalidate S3 pre-signed URLs, audit bucket access policy, notify visitors if identifiable |
| Insider threat (compromised staff account) | Disable Cognito user, rotate agency-scoped credentials, audit all actions in last 30 days |

---

## Security Controls Checklist (per deployment)

- [ ] DPA executed with district before go-live
- [ ] Cognito MFA enforced for admin roles
- [ ] `agencyId` on every DynamoDB read and write
- [ ] No PII (phone, name) logged to CloudWatch
- [ ] NSOPW API called only from Lambda (never from browser/client)
- [ ] Visitor photo S3 bucket is agency-scoped with no public-read ACL
- [ ] Anonymous reporter phone stored as SHA-256 hash only
- [ ] Audit events emitted for all state changes
- [ ] `normalizeSessionRole()` called before any role comparison
- [ ] BTAM records (Phase 2): restricted to TAT members only; not visible to all campus staff

---

## Demo Mode Safety Rules

Demo mode must enforce these controls to prevent accidental harm:

| Rule | Enforcement |
|------|------------|
| No real NSOPW calls | `NSOPW_MOCK=1` env var returns fixture `cleared` result |
| No real SMS sent | `SMS_MOCK=1` logs to console; no Pinpoint API call |
| No real broadcast to external systems | Mock broadcast endpoint returns success without publishing |
| No real student data | Demo tenant uses synthetic names (never real student IDs) |
| No production records affected | Demo tenant uses isolated `agencyId = "demo-campus-sysdistrict"` |

**Demo mode must never query live NSOPW, send real SMS, or affect any live tenant's data.**
