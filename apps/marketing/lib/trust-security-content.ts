/**
 * Marketing /security page — compliance-sensitive copy (no CMS).
 * Structured for future CMS or config injection; wording changes require git review.
 */

export type TrustPillarContent = {
  title: string;
  body: string;
};

export const TRUST_PILLARS: readonly TrustPillarContent[] = [
  {
    title: "Identity & access",
    body: "Cognito-backed sign-in with MFA for privileged roles, JWT-authorized APIs, and role-based access scoped to agency tenancy — not URL parameters.",
  },
  {
    title: "Tenant isolation",
    body: "Operational data is partitioned by agency. Cross-tenant reads and writes are denied by default in application and API layers.",
  },
  {
    title: "Encryption",
    body: "TLS for web and API traffic; encryption at rest on managed data stores, with stronger key management available at deployment.",
  },
  {
    title: "Audit & logging",
    body: "Meaningful state changes emit audit events. Application logs avoid raw secrets, tokens, and full unredacted transcripts.",
  },
  {
    title: "Media & intake",
    body: "Caller-submitted media uses private storage with short-lived, controlled retrieval where configured.",
  },
  {
    title: "Operations",
    body: "Deployment, monitoring, and incident response are documented for review. SIEM and 24/7 response are production-tier options, not the pilot default.",
  },
] as const;

export const SECURITY_PAGE_DISCLAIMER = {
  heading: "What we do not claim on this page",
  bodyLead: "Rapid Cortex does ",
  bodyNegation: "not",
  bodyRest:
    ' assert CJIS, CJIS-ATP, or FedRAMP certification on this page. We have not completed a SOC 2 audit. "CJIS-aligned" means we document controls your assessors can map to the CJIS Security Policy; your agency completes its own authorization path.',
} as const;

export const SECURITY_PAGE_METADATA = {
  title: "Trust & Operations | Rapid Cortex",
  description:
    "Security, privacy, and operational posture for public safety teams — identity controls, tenant isolation, encryption, and CJIS-aligned control mapping for procurement review.",
  keywords: [
    "cjis aligned security",
    "public safety cybersecurity",
    "dispatch platform security",
    "tenant isolation",
    "security controls",
    "psap procurement security",
    "emergency communications security",
  ],
  openGraphImageAlt: "Rapid Cortex trust and security",
} as const;
