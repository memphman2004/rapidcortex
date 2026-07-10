# Data Processing Addendum (DPA) — DRAFT

> **STATUS: DRAFT — COUNSEL REVIEW REQUIRED**  
> **Not executable.** Do not send to customers until legal approves and entity naming is finalized (see [DOCUMENT_GAPS.md](../DOCUMENT_GAPS.md) LEG-007).  
> **Governs:** processing of personal data and operational content when Rapid Cortex is provided as a hosted service.

---

## Parties

| Party | Role |
|-------|------|
| **[AGENCY LEGAL NAME]** (“**Customer**” or “**Controller**”) | Determines purposes and means of processing agency operational data |
| **[CONTRACTING ENTITY — TBD]** (“**Rapid Cortex**” or “**Processor**”) | Processes data on Customer’s instructions per this DPA and the Master Services Agreement (“**MSA**”) |

**Effective date:** [DATE]  
**Incorporation:** This DPA is incorporated into and forms part of the MSA, pilot scope agreement, or order form between the Parties.

---

## 1. Definitions

- **Personal Data** — information relating to an identified or identifiable natural person processed through the Service (e.g. caller phone numbers, names in transcripts, user account identifiers).
- **Operational Data** — incident metadata, transcripts, AI analyses, audit logs, and media linked to incidents, whether or not they contain Personal Data.
- **Service** — Rapid Cortex cloud platform and related support as described in the applicable Statement of Work.
- **Subprocessor** — third party engaged by Processor to process data — see [SUBPROCESSOR_LIST.md](../../security-compliance/SUBPROCESSOR_LIST.md).

Capitalized terms not defined here have meanings in the MSA.

---

## 2. Roles and scope

2.1 **Customer** is the **Controller** (or equivalent) for agency operational and personal data submitted to the Service, except where Customer acts as Processor for its own end users and Rapid Cortex processes only on Customer instructions.

2.2 **Processor** processes Personal Data and Operational Data **only** to:
- Provide the Service per the MSA and Statement of Work;
- Provide support and security monitoring;
- Comply with applicable law; and
- As otherwise documented in writing by Customer.

2.3 Processor **does not** use Customer content to train public foundation models for unrelated products.

---

## 3. Customer instructions

3.1 Customer instructions are the MSA, Statement of Work, this DPA, and documented configuration (tenant settings, retention parameters, enabled modules).

3.2 Processor will notify Customer if an instruction appears to violate applicable law.

---

## 4. Security measures

4.1 Processor implements technical and organizational measures appropriate to risk, including those described in:
- [SECURITY_MODEL.md](../../security-compliance/SECURITY_MODEL.md)
- [TENANT_ISOLATION_MODEL.md](../../security-compliance/TENANT_ISOLATION_MODEL.md)

4.2 Measures include, at minimum: tenant isolation by `agencyId`, encryption in transit, access controls via Cognito JWT and RBAC, secrets in AWS Secrets Manager, and audit logging.

4.3 Processor does **not** represent CJIS, HIPAA, SOC 2, or FedRAMP certification unless a separate executed attestation exists.

---

## 5. Subprocessors

5.1 Customer authorizes Processor to engage Subprocessors listed in the current [SUBPROCESSOR_LIST.md](../../security-compliance/SUBPROCESSOR_LIST.md).

5.2 Processor will provide **30 days’ notice** of material Subprocessor changes (email to Customer security contact).

5.3 Customer may object on reasonable grounds within **14 days**; Parties will work in good faith to resolve. If unresolved, Customer may terminate affected modules per MSA termination articles.

5.4 Processor imposes data protection obligations on Subprocessors substantially similar to this DPA.

---

## 6. Data location

6.1 **Primary region:** [AWS REGION — e.g. us-east-1] unless Statement of Work specifies otherwise.

6.2 **CJIS-sensitive deployments:** Customer may require AWS-only AI/speech providers with external provider keys disabled — documented in implementation workbook.

---

## 7. Retention and deletion

7.1 Retention defaults and agency responsibilities are described in [PRIVACY_RETENTION_DECISIONS.md](../../security-compliance/PRIVACY_RETENTION_DECISIONS.md).

7.2 Upon termination or written request, Processor will **delete or return** Customer data within **[30 / 60]** days except:
- backups on rolling cycles deleted per backup policy;
- data required by law to retain; or
- anonymized aggregates that cannot identify Customer.

7.3 Legal hold: Customer must notify Processor in writing to suspend deletion.

---

## 8. Assistance to Customer

Processor will reasonably assist Customer with:
- Security questionnaires (see [SECURITY_QUESTIONNAIRE_RESPONSES.md](../../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md));
- Data subject requests **to the extent** Processor can verify identity and scope via Customer admin;
- Incident notification per Section 9.

**Fees** for non-standard assistance may apply per MSA professional services rates.

---

## 9. Security incidents

9.1 Processor will notify Customer **without undue delay** (target **[24 / 72]** hours) after confirming a **Security Incident** affecting Customer Personal Data.

9.2 Notification will include: nature of incident, categories of data, measures taken, and contact point.

9.3 Processor will cooperate with Customer’s investigation subject to confidentiality and law enforcement constraints.

---

## 10. International transfers

If processing involves transfers outside Customer’s jurisdiction, Parties will execute appropriate transfer mechanisms (e.g. SCCs) as required by law — **counsel to attach exhibit**.

---

## 11. Audits

11.1 Customer may audit Processor’s compliance **once per 12 months** on **30 days’ notice**, during business hours, without disrupting other customers.

11.2 Processor may satisfy audit with **third-party reports** (e.g. SOC 2) when available.

---

## 12. Liability

Liability caps and exclusions are governed by the **MSA** unless applicable law requires otherwise for data protection breaches.

---

## 13. Term

This DPA remains in effect for the MSA term and until all Customer data is deleted or returned per Section 7.

---

## Signatures

| **Customer** | **Rapid Cortex** |
|--------------|------------------|
| Name: | Name: |
| Title: | Title: |
| Date: | Date: |

---

**Related:** [CONTRACT_PACKAGE_INDEX.md](../CONTRACT_PACKAGE_INDEX.md) · [ORDER_FORM_DRAFT.md](./ORDER_FORM_DRAFT.md)
