import type { NgSecControlEvidence } from "./metrics.js";

/**
 * Static NG-SEC / NIST-CSF themed control catalog for Rapid Cortex evidence exports.
 * Statuses reflect product design defaults; runtime pack may override with agency context.
 */
export const NG_SEC_CONTROL_CATALOG: NgSecControlEvidence[] = [
  {
    controlId: "NG-SEC-AC-01",
    title: "Agency-scoped access control",
    category: "Access Control",
    status: "implemented",
    evidence:
      "All DynamoDB access is keyed by agencyId; AuthorizationService enforces role + tenant scope. rcsuperadmin is the only cross-tenant exemption.",
    references: ["packages/security", "apps/api handlers RBAC gate"],
  },
  {
    controlId: "NG-SEC-AC-02",
    title: "JWT authentication on protected APIs",
    category: "Access Control",
    status: "implemented",
    evidence:
      "API Gateway HTTP API Cognito JWT authorizer on protected routes; BFF resolves session cookies server-side.",
    references: ["infra nested SAM HttpApi authorizer", "apps/web BFF auth"],
  },
  {
    controlId: "NG-SEC-AU-01",
    title: "Audit logging of meaningful state changes",
    category: "Audit & Accountability",
    status: "implemented",
    evidence:
      "AuditRepository + AUDIT_EVENT_TYPES for incidents, triage, diversion, CAD write-back, Silent Text, etc.",
    references: ["packages/security/src/audit-schema.ts", "AUDIT_TABLE"],
  },
  {
    controlId: "NG-SEC-AU-02",
    title: "Immutable deletion audit for CJI retention",
    category: "Audit & Accountability",
    status: "partial",
    evidence:
      "Data deletion audit table and retention executor exist; agency legal-hold workflows remain operational.",
    references: ["DATA_DELETION_AUDIT_TABLE", "retentionExecutor"],
  },
  {
    controlId: "NG-SEC-SC-01",
    title: "Secrets not in Lambda environment plaintext",
    category: "System & Communications Protection",
    status: "implemented",
    evidence:
      "API keys loaded from Secrets Manager ARNs (Anthropic, OpenAI, Twilio); RC_RUNTIME_CONFIG_JSON carries ARNs only.",
    references: ["runtimeSecrets.ts", "Secrets Manager"],
  },
  {
    controlId: "NG-SEC-SC-02",
    title: "TLS for public endpoints",
    category: "System & Communications Protection",
    status: "implemented",
    evidence: "HTTPS via API Gateway, CloudFront, and ALB listeners for web SSR.",
    references: ["CloudFront / ALB / HttpApi"],
  },
  {
    controlId: "NG-SEC-SC-03",
    title: "CORS allow-list (no wildcard in production)",
    category: "System & Communications Protection",
    status: "implemented",
    evidence: "APPROVED_CORS_ORIGINS / HttpApiCorsAllowedOrigins configured per stage.",
    references: ["docs/security-ops-evidence-package.md"],
  },
  {
    controlId: "NG-SEC-SI-01",
    title: "WAF rate limiting available",
    category: "System Integrity",
    status: "partial",
    evidence:
      "Optional API WAF (EnableApiWaf) with rate-limit parameter; confirm live association per stage.",
    references: ["NENA-REF-012 companion theme", "EnableApiWaf"],
  },
  {
    controlId: "NG-SEC-CP-01",
    title: "CAD write-back fail-closed",
    category: "Configuration Management",
    status: "implemented",
    evidence:
      "CAD_WRITEBACK_ENABLED defaults false at every layer; assisted write-back is human-gated and audited.",
    references: ["cad-writeback-gate", "NON_GOALS"],
  },
  {
    controlId: "NG-SEC-IR-01",
    title: "Ops alerting topic",
    category: "Incident Response",
    status: "implemented",
    evidence: "OpsAlertsTopic SNS for CloudWatch alarms on Lambda errors / ops events.",
    references: ["OpsAlertsTopicArn"],
  },
  {
    controlId: "NG-SEC-MP-01",
    title: "Transcript and media retention controls",
    category: "Media Protection",
    status: "implemented",
    evidence:
      "Retention policy service with configurable days; purge executor for expired records.",
    references: ["retention-policy-service", "TRANSCRIPT_RETENTION_POLICY.md"],
  },
  {
    controlId: "NG-SEC-AT-01",
    title: "Role-based product surfaces (least privilege UI)",
    category: "Awareness & Training (ops)",
    status: "implemented",
    evidence:
      "21-role dashboard isolation; forbidden actions omitted from UI rather than grayed-out denials.",
    references: ["docs/role-dashboard-spec.md", "role-nav.ts"],
  },
];
