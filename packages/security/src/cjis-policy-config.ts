/**
 * CJIS-**aligned** control checklist — not a certification claim.
 * Use as architecture guardrails when hardening for government pilots.
 */
export type CjisPolicyConfig = {
  documentId: string;
  version: string;
  controls: readonly string[];
};

export const CJIS_POLICY_CONFIG: CjisPolicyConfig = {
  documentId: "rapid-cortex-cjis-alignment-v1",
  version: "0.1.0",
  controls: [
    "RBAC with least privilege for dispatcher / supervisor / admin",
    "Tenant isolation on all incident-scoped reads and writes",
    "Structured audit trail for authentication, incident access, transcript, analysis, admin",
    "Retention and legal-hold hooks for transcript and audit stores",
    "Secrets via AWS Secrets Manager / SSM — no long-lived keys in repo",
    "TLS for all client and service traffic; optional mTLS for high-trust integrations",
    "Encryption at rest via DynamoDB/S3 default; CMK path for GovCloud",
    "Redaction-ready audit export (no raw PII/transcript unless policy allows)",
  ] as const,
};
