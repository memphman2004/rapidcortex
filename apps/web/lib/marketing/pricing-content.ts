/**
 * Marketing pricing page — consultative packaging copy (no dollar amounts).
 * Structured for future CMS or config injection.
 *
 * Do not publish internal pricing values here. Public pricing should remain quote-based.
 */

import { SITE_NAME } from "@/lib/site";

export { PRICING_COMPARISON_ROW_FEATURE_IDS } from "./pricing-comparison-feature-ids";

export const PRICING_DEMO_MAILTO =
  "mailto:support@rapidcortex.us?subject=Rapid%20Cortex%20%E2%80%94%20Demo%20Request";

export const PRICING_SALES_MAILTO =
  "mailto:support@rapidcortex.us?subject=Rapid%20Cortex%20%E2%80%94%20Sales%20Conversation";

export const PRICING_EXEC_DEMO_MAILTO =
  "mailto:support@rapidcortex.us?subject=Rapid%20Cortex%20%E2%80%94%20Executive%20Demo";

export type PricingPlanId = "essential" | "command" | "enterprise" | "rc_lite";

export type PricingPlanCardContent = {
  id: PricingPlanId;
  name: string;
  /** Short supporting line under the title (e.g. RC Lite positioning). */
  tagline?: string;
  descriptor: string;
  bestForTitle: string;
  bestForBullets: string[];
  capabilities: string[];
  ctaKind: "request_pilot" | "request_demo" | "contact_sales" | "request_rc_lite";
  /** Shown instead of any price — e.g. Custom Quote */
  engagementLabel: string;
};

export const PRICING_PLANS: PricingPlanCardContent[] = [
  {
    id: "essential",
    name: `${SITE_NAME} Essential`,
    descriptor: "Entry-level dashboard platform for small agencies and pilots.",
    bestForTitle: "Best for",
    bestForBullets: [
      "Small cities",
      "Small counties",
      "Pilot programs",
      "Agencies testing Rapid Cortex before a wider rollout",
    ],
    capabilities: [
      "Agency Admin, Dispatcher, and Supervisor dashboards",
      "Basic incident workspace with AI incident summaries",
      "Basic transcription and basic reporting",
      "User management, agency settings, basic audit logs",
      "Standard support and a limited monthly usage allowance",
    ],
    ctaKind: "request_pilot",
    engagementLabel: "Pilot pricing available",
  },
  {
    id: "command",
    name: `${SITE_NAME} Command`,
    descriptor:
      "Full operational dashboard platform for dispatchers, supervisors, QA, reporting, and caller media.",
    bestForTitle: "Best for",
    bestForBullets: [
      "Medium to large PSAPs",
      "Counties and emergency management agencies",
      "Production deployments that need QA and command visibility",
    ],
    capabilities: [
      "Everything in Essential, plus QA / Training and Executive / Reporting dashboards",
      "IT / Security Admin dashboard and advanced supervisor monitoring",
      "Translation, caller text/photo/video links, and advanced incident reporting",
      "Operational Mapbox surfaces, LiveLocation (SMS GPS link), and Surge View related-call grouping when enabled for your rollout",
      "Shift reports, compliance-ready audit logs, expanded usage, optional priority support",
    ],
    ctaKind: "request_demo",
    engagementLabel: "Custom pricing",
  },
  {
    id: "enterprise",
    name: "Enterprise / Statewide",
    descriptor: "Custom deployment for large agencies, regional systems, and statewide public safety programs.",
    bestForTitle: "Best for",
    bestForBullets: [
      "Statewide deployments",
      "Large counties",
      "Regional 911 networks",
      "Enterprise public safety organizations",
    ],
    capabilities: [
      "Everything in Command plus multi-agency management and cross-agency reporting",
      "Dedicated onboarding and custom integrations; optional AWS GovCloud deployment",
      "Custom SLA, dedicated support options, security/compliance evidence support",
      "Custom usage allowances and annual contract support",
    ],
    ctaKind: "contact_sales",
    engagementLabel: "Contact Support",
  },
  {
    id: "rc_lite",
    name: "RC Lite",
    tagline: "Rapid Cortex intelligence without another dashboard",
    descriptor:
      "Standalone API product sold separately from Rapid Cortex Essential / Command / Enterprise. RC Lite is not a smaller dashboard—it is secure intelligence APIs (incident analysis, CAD export, STT/TTS, multilingual, caller media, QA automation) plus metering, webhooks, hashed API keys, and the developer portal—without dispatcher, supervisor, QA, or agency admin consoles.",
    bestForTitle: "Best for",
    bestForBullets: [
      "API-only or API add-on access for agencies and approved vendors",
      "CAD vendors, RMS vendors, GIS systems, and municipal IT teams",
      "Statewide public safety platforms embedding intelligence in existing consoles",
    ],
    capabilities: [
      "Incident intelligence APIs, CAD export API, transcription, translation, caller media/link surfaces, QA analysis",
      "Webhooks (`incident.analyzed`, `cad.export.*`, media + QA completions, etc.)",
      "Hashed API keys + scoped secrets, metering, developer portal (/developers), sandbox + production tiers",
      "No dispatcher workspace, supervisor tools, ECC incident console, or agency admin workflows",
    ],
    ctaKind: "request_rc_lite",
    engagementLabel: "Custom pricing",
  },
];

/** Dashboard / full-platform SKUs only (Rapid Cortex Essential, Command, Enterprise). */
export const PRICING_PLATFORM_PLANS: PricingPlanCardContent[] = PRICING_PLANS.filter((p) => p.id !== "rc_lite");

export const PRICING_RC_LITE_PLAN: PricingPlanCardContent | undefined = PRICING_PLANS.find((p) => p.id === "rc_lite");

/** Comparison cell: full = included, limited = partial, addon = available as add-on, none = not in tier */
export type ComparisonCell = "full" | "limited" | "addon" | "none";

export type ComparisonRowDef = {
  label: string;
  essential: ComparisonCell;
  professional: ComparisonCell;
  command: ComparisonCell;
  enterprise: ComparisonCell;
  rc_lite: ComparisonCell;
};

export type ComparisonCategoryDef = {
  category: string;
  rows: ComparisonRowDef[];
};

/** Public pricing matrix — two headline capabilities per category (detailed SOW may include more). */
export const PRICING_COMPARISON: ComparisonCategoryDef[] = [
  {
    category: "Core platform",
    rows: [
      {
        label: "Web application access",
        essential: "full",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "none",
      },
      {
        label: "Role-based access control",
        essential: "full",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "limited",
      },
    ],
  },
  {
    category: "Call handling / operations",
    rows: [
      {
        label: "AI-assisted intake",
        essential: "full",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "limited",
      },
      {
        label: "Live transcription",
        essential: "full",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "full",
      },
    ],
  },
  {
    category: "Language / communication",
    rows: [
      {
        label: "Multilingual intake",
        essential: "limited",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "limited",
      },
      {
        label: "Live translation",
        essential: "addon",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "full",
      },
    ],
  },
  {
    category: "Media / evidence",
    rows: [
      {
        label: "Caller photo upload",
        essential: "addon",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "full",
      },
      {
        label: "Live caller media streaming",
        essential: "addon",
        professional: "limited",
        command: "full",
        enterprise: "full",
        rc_lite: "addon",
      },
    ],
  },
  {
    category: "Supervisor / QA",
    rows: [
      {
        label: "QA review tools",
        essential: "limited",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "limited",
      },
      {
        label: "Team performance dashboards",
        essential: "addon",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "none",
      },
    ],
  },
  {
    category: "Incident command / collaboration",
    rows: [
      {
        label: "Major incident management",
        essential: "none",
        professional: "addon",
        command: "full",
        enterprise: "full",
        rc_lite: "none",
      },
      {
        label: "Command dashboard",
        essential: "none",
        professional: "addon",
        command: "full",
        enterprise: "full",
        rc_lite: "none",
      },
    ],
  },
  {
    category: "Situational awareness & CAD intelligence",
    rows: [
      {
        label: "LiveLocation caller location (SMS GPS link)",
        essential: "addon",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "none",
      },
      {
        label: "Operational maps (Mapbox workspace)",
        essential: "addon",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "limited",
      },
    ],
  },
  {
    category: "Reliability / technical operations",
    rows: [
      {
        label: "Monitoring integrations",
        essential: "addon",
        professional: "limited",
        command: "full",
        enterprise: "full",
        rc_lite: "full",
      },
      {
        label: "Reliability reporting",
        essential: "none",
        professional: "addon",
        command: "full",
        enterprise: "full",
        rc_lite: "limited",
      },
    ],
  },
  {
    category: "Deployment / support",
    rows: [
      {
        label: "Standard onboarding",
        essential: "full",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "full",
      },
      {
        label: "Integration assistance",
        essential: "limited",
        professional: "full",
        command: "full",
        enterprise: "full",
        rc_lite: "full",
      },
    ],
  },
];

export type PricingAddonItem = {
  id: string;
  title: string;
  description: string;
};

export const PRICING_ADDONS: PricingAddonItem[] = [
  {
    id: "cad_integration",
    title: "CAD Integration",
    description:
      "CAD-ready incident export, agency-specific CAD mapping, optional manual review before submission, CAD submission audit logs, integration health monitoring, and error/retry handling.",
  },
  {
    id: "ai_call_intelligence",
    title: "AI / Call Intelligence",
    description:
      "AI incident summaries, risk cues, classification suggestions, dispatcher support prompts, supervisor alerting, and QA comparison between transcripts and summaries where policy permits.",
  },
  {
    id: "transcription_translation",
    title: "Transcription / Translation",
    description:
      "Recorded and live-aligned speech workflows, prioritized language pairs, bilingual summaries, and translation audit artifacts for operational review.",
  },
  {
    id: "caller_media",
    title: "Caller Text, Photo, and Video",
    description:
      "Caller SMS workflows, uploads, live video session support, agency media controls, and evidence-aligned retention tuning.",
  },
  {
    id: "supervisor_qa",
    title: "Supervisor / QA",
    description:
      "Silent supervisor assist, QA review workflows, coaching notes, assignments, scorecards where enabled, and performance trend summaries.",
  },
  {
    id: "api_access",
    title: "API Access add-on",
    description:
      "Adds secure external REST access on top of Rapid Cortex Command or Enterprise when you already run the operational web dashboards—OAuth clients, webhooks, sandbox vs production tiers, metering, audit artifacts. For integrations that never adopt those dashboards, use the RC Lite standalone product instead.",
  },
  {
    id: "premium_support",
    title: "Premium Support",
    description:
      "Priority response pathways, expanded coverage windows, dedicated onboarding acceleration, quarterly system reviews, and training refresh lanes.",
  },
  {
    id: "onsite_deployment_training",
    title: "Onsite Deployment / Training",
    description:
      "Onsite onboarding and role-based training lanes for admins, dispatch, supervisors, QA, IT/security, and supervised go-live support.",
  },
];

export type PricingFaqItem = { id: string; question: string; answer: string };

export const PRICING_FAQ: PricingFaqItem[] = [
  {
    id: "why-no-prices",
    question: "Why are prices not listed publicly?",
    answer:
      "Public safety and regional programs rarely fit a one-size catalog. Scope depends on seats, sites, modules, integrations, support tier, and retention requirements. We publish packaging here so teams can align on capability; numbers land in a procurement-friendly quote after discovery.",
  },
  {
    id: "how-scoped",
    question: "How is Rapid Cortex scoped for our agency?",
    answer:
      "We run a structured discovery with IT, comms leadership, and operations. That yields a deployment plan: which modules go live first, which integrations are phased, and how training and cutover are sequenced. The goal is operational fit—not a generic SKU checkout.",
  },
  {
    id: "pilots",
    question: "Do you offer pilots?",
    answer:
      "Yes. Many agencies begin with a bounded pilot on Essential packaging, then expand modules and sites as confidence and governance milestones are met.",
  },
  {
    id: "multi-center",
    question: "Can Rapid Cortex support multiple centers or agencies?",
    answer:
      "Command tiers are built for heavier multi-team operational load. Enterprise / Statewide adds multi-site and multi-agency architecture, coordinated procurement, and rollout governance across jurisdictions.",
  },
  {
    id: "ways-to-pay",
    question: "What payment options exist for agencies and vendors?",
    answer:
      "Rapid Cortex supports monthly subscriptions where appropriate through secure card billing, alongside annual contracts, purchase orders, Net-30/45 invoice workflows, pilot programs, and custom enterprise agreements. RC Lite is invoiced separately as its own integration product (API-only). If you already run Command or Enterprise dashboards, API Access can be added onto that subscription instead.",
  },
  {
    id: "integrations",
    question: "Are integrations included?",
    answer:
      "Standard integration assistance is reflected in the comparison table by tier. Deep CAD, radio, or vendor-specific work is typically scoped as add-on integration packages so dependencies and acceptance tests are explicit.",
  },
  {
    id: "onboarding",
    question: "Is onboarding required?",
    answer:
      "Every production rollout includes scoped onboarding and deployment planning. Premium onboarding expands cutover support, training depth, and hypercare windows—especially for Command and Enterprise programs.",
  },
  {
    id: "custom-deploy",
    question: "Do you support custom deployments?",
    answer:
      "Enterprise / Statewide engagements routinely include private or isolated deployment options, custom security and compliance review, and tailored architecture. Command customers may add elements à la carte as their program matures.",
  },
  {
    id: "training",
    question: "Do you offer training for dispatchers, supervisors, and admins?",
    answer:
      "Yes. Training paths are role-specific: call-taking and dispatch workflows, supervisor QA and coaching, and admin configuration. Delivery format and hours are set during onboarding so your floor leads own sustainment.",
  },
];
