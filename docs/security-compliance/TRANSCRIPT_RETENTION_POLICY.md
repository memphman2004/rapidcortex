# Transcript and incident data retention (pilot)

## Purpose

Agencies need a **documented** maximum retention and disposition path for **transcript segments**, **AI analyses**, and related **incident** metadata. This file ties **governance** to **deployable configuration** without claiming automatic legal compliance.

## What the product stores

See [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) (tables, S3, audit). The API stores transcripts and analyses in **DynamoDB** (and optional **S3** for media) per your stack outputs.

## Configurable value (pilot / prod)

- **CloudFormation** parameter: **`TranscriptRetentionPolicyDays`** (optional string).  
  When set (e.g. `2555` for a seven-year policy discussion), it is passed to all API Lambdas as:

  **`TRANSCRIPT_RETENTION_POLICY_DAYS`**

- **Meaning:** **agency SOP** — “we intend to hold transcript-related operational data for at most *N* days unless legal hold or export applies.”
- **Enforcement:** this repository does **not** run a scheduled purge job on that value by default. Operational enforcement is **export → delete** (or backup retention outside application tables) per your counsel and [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) section 4–6.
- **Application use:** the variable is available in the API runtime (`env.transcriptRetentionPolicyDays`) for future admin/compliance UI or reports — **set the parameter** on pilot/prod so the number is not empty when you need traceability.

## Related

- [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)  
- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)  
- [INSTALLATION.md](./INSTALLATION.md) / [DEPLOYMENT.md](./DEPLOYMENT.md) for stage-specific deploys.
