import type { RoiVertical } from "./sales-enablement-types.js";

export type SalesFeatureVertical = RoiVertical | "all";

export type SalesFeatureFreeKind = "permanent" | "one_time_service";

/**
 * Sales-facing offerable feature — no prices.
 * Separate from monetization PLAN_BASE / TenantEntitlements.
 */
export type SalesFeatureCatalogItem = {
  id: string;
  name: string;
  explanation: string;
  compatibleVerticals: readonly SalesFeatureVertical[];
  isFree: boolean;
  freeKind?: SalesFeatureFreeKind;
  /** Never offer as complimentary / free on an order */
  neverFree?: boolean;
  category: string;
};

const ALL: SalesFeatureVertical[] = ["rc911", "campus", "venue", "hospital", "transit"];

export const SALES_FEATURE_CATALOG: readonly SalesFeatureCatalogItem[] = [
  // ── Free strategic offerings ──────────────────────────────────────────────
  {
    id: "community_tip_line",
    name: "NexCort iQ Community Connect",
    explanation:
      "Permanent free tip line for qualifying institutions: one QR code, one physical zone, tip submissions forwarded to a designated email. No dispatcher console, analytics, two-way chat, AI, or Clery log.",
    compatibleVerticals: ["campus", "venue"],
    isFree: true,
    freeKind: "permanent",
    category: "Free offerings",
  },
  {
    id: "agency_intelligence_scan",
    name: "Complimentary Operational Intelligence Report",
    explanation:
      "One-time service: agency provides 30–60 days of anonymized CAD export (call type, timestamp, duration). Deliver a 3–5 page PDF — volume by hour, call-type mix, language %, peak load, admin time estimates. Limited availability.",
    compatibleVerticals: ["all"],
    isFree: true,
    freeKind: "one_time_service",
    category: "Free offerings",
  },
  {
    id: "dispatcher_wellness",
    name: "NexCort iQ Wellness",
    explanation:
      "Permanent free anonymous end-of-shift check-in for dispatchers (60 seconds). Supervisors see aggregate wellness only — no call data, transcripts, or CJIS exposure. Free for accredited PSAPs.",
    compatibleVerticals: ["rc911"],
    isFree: true,
    freeKind: "permanent",
    category: "Free offerings",
  },

  // ── Paid capabilities (offerable; no prices in sales UI) ───────────────────
  {
    id: "live_transcription",
    name: "Live transcription",
    explanation:
      "Real-time call transcription for dispatchers. Core differentiator — do not include as free.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    neverFree: true,
    category: "911 Centers / PSAPs",
  },
  {
    id: "ai_call_intelligence",
    name: "AI-assisted triage & confidence scoring",
    explanation:
      "AI triage suggestions and confidence scoring on live calls. Core paid capability — never free.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    neverFree: true,
    category: "911 Centers / PSAPs",
  },
  {
    id: "cad_writeback",
    name: "CAD write-back",
    explanation:
      "Assisted or automated CAD write-back. Requires signed agency addendum. Never free or informal.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    neverFree: true,
    category: "CAD Integration",
  },
  {
    id: "cad_readonly",
    name: "CAD read-only integration",
    explanation: "One-way read from agency CAD into the NexCort iQ context panel.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    category: "CAD Integration",
  },
  {
    id: "transcription_translation",
    name: "Transcription & translation",
    explanation: "Multi-language transcription and live translation assist for telecommunicators.",
    compatibleVerticals: ["rc911", "campus", "venue"],
    isFree: false,
    category: "Language",
  },
  {
    id: "caller_media",
    name: "Caller media intake",
    explanation: "Secure intake of photos, video, and location media from callers or field units.",
    compatibleVerticals: ["rc911", "campus", "venue", "transit"],
    isFree: false,
    category: "Media",
  },
  {
    id: "supervisor_qa",
    name: "Supervisor QA & coaching",
    explanation: "QA scorecards, coaching workflows, and post-incident review tools.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    category: "Quality",
  },
  {
    id: "api_access",
    name: "API access",
    explanation: "Programmatic API access for agency integrations and reporting.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Platform",
  },
  {
    id: "premium_support",
    name: "Premium support",
    explanation: "Elevated support SLAs and dedicated success contact.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Support",
  },
  {
    id: "team_dashboards",
    name: "Team performance dashboards",
    explanation: "Shift and team KPIs for supervisors and agency leadership.",
    compatibleVerticals: ["rc911", "campus", "venue", "transit"],
    isFree: false,
    category: "Analytics",
  },
  {
    id: "command_dashboard",
    name: "Command dashboard & war rooms",
    explanation: "Command-level situational awareness and war-room collaboration.",
    compatibleVerticals: ["rc911", "campus", "venue"],
    isFree: false,
    category: "Command",
  },
  {
    id: "tip_console",
    name: "Security / tip console",
    explanation: "Full tip inbox with two-way chat, assignment, and status tracking (beyond free email-only).",
    compatibleVerticals: ["campus", "venue", "transit"],
    isFree: false,
    category: "Campus & Venue",
  },
  {
    id: "clery_documentation",
    name: "Clery documentation log",
    explanation: "Clery Act documentation and daily crime log workflows for campuses.",
    compatibleVerticals: ["campus"],
    isFree: false,
    category: "Campus & Venue",
  },
  {
    id: "multi_qr_zones",
    name: "Multi-zone QR / NFC",
    explanation: "More than one QR zone plus NFC tag support for campus and venue sites.",
    compatibleVerticals: ["campus", "venue", "transit"],
    isFree: false,
    category: "Campus & Venue",
  },
  {
    id: "tip_analytics",
    name: "Tip & incident analytics",
    explanation: "Trend analytics and reporting on tip volume, types, and response times.",
    compatibleVerticals: ["campus", "venue", "transit"],
    isFree: false,
    category: "Analytics",
  },
  {
    id: "hospital_capacity",
    name: "Hospital capacity portal",
    explanation: "Live ER capacity, diversion status, and EMS pre-alert coordination.",
    compatibleVerticals: ["hospital", "rc911"],
    isFree: false,
    category: "Hospital",
  },
  {
    id: "transit_ops",
    name: "Transit operations console",
    explanation: "Route/zone ops, passenger reports, and transit security workflows.",
    compatibleVerticals: ["transit"],
    isFree: false,
    category: "Transit",
  },
  {
    id: "onsite_deployment_training",
    name: "Onsite deployment & training",
    explanation: "Onsite implementation and training package for go-live.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Implementation",
  },
  {
    id: "setup_implementation_fee",
    name: "Setup & implementation",
    explanation: "Remote setup, configuration, and implementation services.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Implementation",
  },
] as const;

export function salesFeatureCompatibleWithVertical(
  item: SalesFeatureCatalogItem,
  vertical: RoiVertical,
): boolean {
  if (item.compatibleVerticals.includes("all")) return true;
  return item.compatibleVerticals.includes(vertical);
}

export function filterSalesFeatureCatalog(
  vertical: RoiVertical | "all",
  opts?: { freeOnly?: boolean },
): SalesFeatureCatalogItem[] {
  return SALES_FEATURE_CATALOG.filter((item) => {
    if (opts?.freeOnly && !item.isFree) return false;
    if (vertical === "all") return true;
    return salesFeatureCompatibleWithVertical(item, vertical);
  });
}

export function getSalesFeatureById(id: string): SalesFeatureCatalogItem | undefined {
  return SALES_FEATURE_CATALOG.find((f) => f.id === id);
}

export function verticalLabelForSales(v: SalesFeatureVertical): string {
  switch (v) {
    case "rc911":
      return "911 Centers / PSAPs";
    case "campus":
      return "Campus";
    case "venue":
      return "Venue";
    case "hospital":
      return "Hospital";
    case "transit":
      return "Transit";
    case "all":
      return "All verticals";
    default:
      return v;
  }
}
