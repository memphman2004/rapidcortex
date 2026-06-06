/**
 * Compliance & trust disclosures — wording must remain factual.
 * CJIS-aligned is accurate only once controls + agreements exist; avoid claiming certification casually.
 */

export type RcLiteTrustArtifactId =
  | "cjis_controls_alignment"
  | "soc2_roadmap"
  | "encryption_at_rest_transit"
  | "audit_logging"
  | "tenant_isolation"
  | "data_retention_policy"
  | "subprocessors"
  | "incident_response"
  | "responsible_disclosure"
  | "security_contact"
  | "uptime_history";

export const RC_LITE_TRUST_CENTER_SECTIONS: readonly {
  id: RcLiteTrustArtifactId;
  title: string;
  summary: string;
}[] = [
  {
    id: "cjis_controls_alignment",
    title: "CJIS-aligned controls",
    summary:
      "Control mapping and evidence collection for agencies requiring CJIS Security Policy alignment—without claiming formal CJIS approval until your program has executed required agreements.",
  },
  {
    id: "soc2_roadmap",
    title: "SOC 2 roadmap",
    summary: "Policy, evidence, pen tests, vendor risk, and uptime reporting aligned toward SOC 2 readiness.",
  },
  {
    id: "encryption_at_rest_transit",
    title: "Encryption posture",
    summary: "TLS in transit plus KMS-backed encryption envelopes for persisted secrets/tokens/media metadata.",
  },
  {
    id: "audit_logging",
    title: "Audit logging",
    summary: "API request envelopes with tenant/key identifiers suited for agency audit exports.",
  },
  {
    id: "tenant_isolation",
    title: "Tenant isolation",
    summary: "Per-tenant scoping enforced on every authenticated call; denies cross-tenant reads/writes by default.",
  },
  {
    id: "data_retention_policy",
    title: "Data retention",
    summary: "Configurable retention horizons for transcripts, QA artifacts, and media TTL (contract bound).",
  },
  {
    id: "subprocessors",
    title: "Subprocessors",
    summary: "Disclosed infrastructure stack (AWS primitives, KMS, telemetry) documented for procurement reviews.",
  },
  {
    id: "incident_response",
    title: "Incident response contact",
    summary: "Coordinated escalation for API availability and suspected credential compromise workflows.",
  },
  {
    id: "responsible_disclosure",
    title: "Responsible disclosure",
    summary: "Coordinated researcher reporting path with agreed SLAs.",
  },
  {
    id: "security_contact",
    title: "Security contact",
    summary: "Public safety–aware security desk for agencies and CAD vendor partners.",
  },
  {
    id: "uptime_history",
    title: "Uptime transparency",
    summary: "Planned ingestion of SLA counters into the public `/developers/status` timeline.",
  },
];
