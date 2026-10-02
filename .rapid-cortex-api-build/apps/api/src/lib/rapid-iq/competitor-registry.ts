import type { RapidIqOpportunity } from "rapid-cortex-shared";

export type CompetitorVertical = "911" | "campus" | "venue" | "all";

export type Competitor = {
  id: string;
  name: string;
  aliases: string[];
  verticals: CompetitorVertical[];
  products: string[];
  hq: string;
  funding: string | null;
  recentNews: string | null;
  displacementNotes: string;
  rcAdvantages: string[];
  urgencyLevel: "high" | "medium" | "low";
};

export const COMPETITOR_REGISTRY: Competitor[] = [
  // ── 911 / PSAP ───────────────────────────────────────────────────────────
  {
    id: "axon",
    name: "Axon",
    aliases: [
      "Axon Enterprise",
      "Carbyne",
      "Prepared",
      "Axon 911",
      "carbyne911",
      "preparedai",
      "TASER",
    ],
    verticals: ["911"],
    products: [
      "Evidence.com",
      "Carbyne NG911",
      "Prepared AI",
      "Axon CAD",
      "Axon Records",
      "Fusus",
    ],
    hq: "Scottsdale, AZ",
    funding: "Public (AXON)",
    recentNews:
      "Acquired Carbyne ($625M, Nov 2025) and Prepared (~$850M, Sep 2025). Now owns the full 911 stack from CAD to AI to body cameras.",
    displacementNotes:
      "Agencies concerned about vendor lock-in across entire public safety stack. Carbyne/Prepared integrations still incomplete post-acquisition. Small agencies priced out of full Axon stack.",
    rcAdvantages: [
      "RC is independent — no vendor lock-in across CAD, cameras, and dispatch",
      "RC AI is built specifically for 911 call intelligence, not retrofitted from body cam tech",
      "RC offers NG911 readiness without replacing existing CAD investment",
      "Veteran-owned, mission-focused — not a publicly traded defense company",
    ],
    urgencyLevel: "high",
  },
  {
    id: "carbyne",
    name: "Carbyne",
    aliases: ["Carbyne NG911", "carbyne911.com", "Carbyne Communications"],
    verticals: ["911"],
    products: ["Carbyne Platform", "APEX", "Smart911 (via Axon)"],
    hq: "New York, NY (now Axon subsidiary)",
    funding: "Acquired by Axon ($625M, Nov 2025)",
    recentNews:
      "Acquired by Axon. Integration ongoing. Some agencies uncertain about product roadmap under new ownership.",
    displacementNotes:
      "Post-acquisition uncertainty. Agencies not wanting to be fully inside Axon ecosystem. Contract renewals are inflection points.",
    rcAdvantages: [
      "RC offers NG911 capabilities without Axon ecosystem dependency",
      "Contract expiry post-Axon acquisition = prime outreach window",
    ],
    urgencyLevel: "high",
  },
  {
    id: "prepared",
    name: "Prepared",
    aliases: ["Prepared AI", "prepared.ai", "Prepared 911"],
    verticals: ["911"],
    products: ["Prepared AI Platform", "911 AI", "Transcription AI"],
    hq: "San Francisco, CA (now Axon subsidiary)",
    funding: "Acquired by Axon (~$850M, Sep 2025)",
    recentNews: "Acquired by Axon. Product integration with Axon stack underway.",
    displacementNotes:
      "Agencies that adopted early-stage Prepared AI may have concerns about direction under Axon ownership. Non-Axon agencies may seek independent AI options.",
    rcAdvantages: [
      "RC AI transcription and coaching is independent — not tied to Axon",
      "RC built AI on top of real 911 call data from day one",
    ],
    urgencyLevel: "high",
  },
  {
    id: "motorola",
    name: "Motorola Solutions",
    aliases: [
      "Motorola",
      "PremierOne",
      "CommandCentral",
      "VESTA",
      "Spillman",
      "Premier One",
      "PremierOne CAD",
      "Zetron",
      "Avigilon",
      "LiveSafe",
      "Exacom",
      "Hyper AI",
    ],
    verticals: ["911", "campus"],
    products: [
      "PremierOne CAD",
      "CommandCentral Vault",
      "VESTA 911",
      "Zetron dispatch",
      "Avigilon cameras",
      "Exacom recording",
      "Hyper AI",
    ],
    hq: "Chicago, IL",
    funding: "Public (MSI)",
    recentNews:
      "Acquired Exacom (cloud recording, Mar 2026) and Hyper (AI for non-emergency calls, Apr 2026) to compete with Axon.",
    displacementNotes:
      "Motorola's acquisition spree creates complexity. Agencies on aging PremierOne CAD facing end-of-life pressure. Mid-size agencies priced out of full Motorola stack post-consolidation.",
    rcAdvantages: [
      "RC enhances existing Motorola CAD rather than replacing it",
      "RC AI layer sits above the CAD — no rip-and-replace required",
      "Motorola pricing is enterprise-tier — RC is accessible to smaller agencies",
    ],
    urgencyLevel: "high",
  },
  {
    id: "rapidsos",
    name: "RapidSOS",
    aliases: [
      "Rapid SOS",
      "rapidsos.com",
      "Rave Mobile Safety",
      "RaveGuardian",
      "Rave Alert",
      "Rave Panic Button",
      "Rave Guardian",
      "Northern911",
    ],
    verticals: ["911", "campus"],
    products: [
      "RapidSOS Platform",
      "Rave Alert",
      "Rave Guardian",
      "Rave Panic Button",
      "Smart911",
      "HARMONY",
    ],
    hq: "New York, NY",
    funding: "$100M raised Nov 2025 (Apax Digital). Acquired Rave Mobile Safety, Northern911.",
    recentNews:
      "Raised $100M, acquired Northern911 for mutual aid coverage, launched Real-Time Interoperability (Jan 2026). Now covers 22,000+ agencies.",
    displacementNotes:
      "RapidSOS is becoming infrastructure — not a product agencies choose, but one they get bundled with. Agencies wanting to own their own data and AI layer look for alternatives. Campus: Rave Guardian is the dominant app but lacks the operations depth RC offers.",
    rcAdvantages: [
      "RC owns the AI layer — not dependent on RapidSOS data pipes",
      "RC provides dispatcher coaching and CAD integration Rave doesn't offer",
      "For campus: RC QR reporting > Rave Guardian tip-only model",
    ],
    urgencyLevel: "high",
  },
  {
    id: "centralsquare",
    name: "CentralSquare",
    aliases: [
      "CentralSquare Technologies",
      "Tyler Public Safety",
      "New World CAD",
      "Inform CAD",
      "Tyler Technologies",
    ],
    verticals: ["911"],
    products: ["CentralSquare CAD", "CentralSquare RMS", "New World CAD", "Inform Public Safety"],
    hq: "Lake Mary, FL",
    funding: "Private Equity (Vista Equity). Now Tyler Technologies division.",
    recentNews: "Integrated into Tyler Technologies public safety division.",
    displacementNotes:
      "Legacy CAD customer base facing modernization pressure. Tyler acquisition created integration uncertainty. Agencies on CentralSquare/New World looking at NG911 upgrades.",
    rcAdvantages: [
      "RC integrates with CentralSquare CAD — no replacement required",
      "RC adds NG911 AI layer on top of existing CentralSquare investment",
    ],
    urgencyLevel: "medium",
  },
  {
    id: "hexagon",
    name: "Hexagon",
    aliases: ["Hexagon Safety", "Intergraph", "CAD Commander", "I/CAD", "Hexagon PPM"],
    verticals: ["911"],
    products: ["CAD Commander", "I/CAD", "HxGN OnCall Dispatch"],
    hq: "Stockholm, Sweden",
    funding: "Public (HEXA B)",
    recentNews: "Partnership with RapidSOS for Digital Alerts in El Paso County.",
    displacementNotes:
      "Legacy CAD, aging customer base. International company with US government concerns about data sovereignty.",
    rcAdvantages: [
      "RC is CJIS-aware and US-hosted — no foreign data sovereignty concerns",
      "RC AI layer adds modern capabilities to Hexagon CAD environments",
    ],
    urgencyLevel: "medium",
  },
  {
    id: "mark43",
    name: "Mark43",
    aliases: ["mark43.com"],
    verticals: ["911"],
    products: ["Mark43 CAD", "Mark43 RMS", "Mark43 Analytics"],
    hq: "New York, NY",
    funding: "Venture-backed ($179M total)",
    recentNews: null,
    displacementNotes:
      "Modern cloud CAD but less dispatch-AI focused than RC. Venture-backed — funding pressure may drive partnership opportunities.",
    rcAdvantages: [
      "RC complements Mark43 with the AI call intelligence layer Mark43 lacks",
      "Partnership or integration opportunity exists",
    ],
    urgencyLevel: "low",
  },
  {
    id: "rapiddeploy",
    name: "RapidDeploy",
    aliases: ["Radius", "rapiddeploy.com"],
    verticals: ["911"],
    products: ["RapidDeploy CAD", "Radius Mapping", "Radius Analytics"],
    hq: "Austin, TX",
    funding: "Venture-backed",
    recentNews: null,
    displacementNotes:
      "Cloud-native CAD competitor but smaller scale. Agencies choosing RapidDeploy over Motorola may be open to RC AI add-on.",
    rcAdvantages: ["RC AI transcription complements RapidDeploy CAD"],
    urgencyLevel: "low",
  },
  {
    id: "intrado",
    name: "Intrado",
    aliases: ["West Technology", "West Safety", "Intrado Life & Safety"],
    verticals: ["911"],
    products: ["Intrado VIPER", "Power911", "Emergency Call Routing"],
    hq: "Longmont, CO",
    funding: "Private",
    recentNews: null,
    displacementNotes: "Legacy CPE / call-handling footprint. Agencies modernizing NG911 look beyond Intrado-only stacks.",
    rcAdvantages: [
      "RC adds AI call intelligence without replacing Intrado CPE",
    ],
    urgencyLevel: "medium",
  },

  // ── Campus ───────────────────────────────────────────────────────────────
  {
    id: "omnilert",
    name: "Omnilert",
    aliases: ["omnilert.com", "Gun Detect"],
    verticals: ["campus"],
    products: ["Omnilert Gun Detect", "Omnilert e2Campus", "Omnilert mass notification"],
    hq: "Leesburg, VA",
    funding: "Private",
    recentNews: null,
    displacementNotes:
      "Gun detection AI — single-purpose tool. Campus safety directors want a broader operations platform, not just detection.",
    rcAdvantages: [
      "RC is a full campus safety operations platform, not a single-feature detector",
      "RC QR incident reporting covers the 90% of incidents that aren't weapon-related",
    ],
    urgencyLevel: "medium",
  },
  {
    id: "navigate360",
    name: "Navigate360",
    aliases: ["navigate360.com", "ALICE Training", "PBIS Rewards", "Rhithm", "SchoolDude"],
    verticals: ["campus"],
    products: ["Navigate360 Safety Platform", "ALICE Training", "Crisis Response", "School Safety"],
    hq: "Richfield, OH",
    funding: "Private Equity (Peppertree Capital)",
    recentNews: null,
    displacementNotes:
      "Primarily K-12 focused. Limited higher ed presence. Platform is broad but not 911-integrated.",
    rcAdvantages: [
      "RC Campus is built for higher education, not K-12",
      "RC connects campus incidents directly to 911 dispatch",
    ],
    urgencyLevel: "medium",
  },
  {
    id: "alertus",
    name: "Alertus Technologies",
    aliases: ["alertus.com", "Alertus mass notification", "Alertus"],
    verticals: ["campus"],
    products: ["Alertus Mass Notification", "Desktop Alerts", "Digital Signage Alerts"],
    hq: "Baltimore, MD",
    funding: "Private",
    recentNews: null,
    displacementNotes:
      "Notification-only platform. No incident management, no QR reporting, no 911 integration.",
    rcAdvantages: [
      "RC provides incident management + reporting + notification in one platform",
      "RC's QR-based reporting works without app downloads",
    ],
    urgencyLevel: "low",
  },
  {
    id: "everbridge",
    name: "Everbridge",
    aliases: ["everbridge.com", "Everbridge Campus", "xMatters"],
    verticals: ["campus"],
    products: [
      "Everbridge Critical Event Management",
      "Mass Notification",
      "Safety Connection",
    ],
    hq: "Burlington, MA",
    funding: "Private (taken private by Thoma Bravo, 2023)",
    recentNews: "Taken private by Thoma Bravo. Cost-cutting and platform consolidation underway.",
    displacementNotes:
      "Post-PE acquisition pricing pressure. Mass notification platform without true campus operations depth.",
    rcAdvantages: [
      "RC is purpose-built for campus safety, not a general enterprise notification tool",
      "Everbridge post-PE pricing increases create switching opportunities",
    ],
    urgencyLevel: "medium",
  },
  {
    id: "omnigo",
    name: "Omnigo",
    aliases: ["omnigo.com", "Informer", "GuardTek"],
    verticals: ["campus", "venue"],
    products: ["Omnigo Incident Management", "GuardTek", "Report Exec"],
    hq: "Irving, TX",
    funding: "Private Equity",
    recentNews: null,
    displacementNotes:
      "Legacy incident management platform. Lacks modern AI capabilities. Common in campus and venue environments.",
    rcAdvantages: [
      "RC AI coaching and real-time transcription vs. Omnigo's manual logging",
      "RC QR guest reporting vs. Omnigo's staff-only model",
    ],
    urgencyLevel: "medium",
  },
  {
    id: "zeroeyes",
    name: "ZeroEyes",
    aliases: ["zeroeyes.com", "ZeroEyes AI", "ZeroTrak"],
    verticals: ["campus"],
    products: ["ZeroEyes Gun Detection AI"],
    hq: "Conshohocken, PA",
    funding: "Venture-backed",
    recentNews: null,
    displacementNotes:
      "Single-purpose gun detection. Campus directors asking what platform manages incidents after detection.",
    rcAdvantages: [
      "RC is the operations platform ZeroEyes alerts flow into",
      "ZeroEyes + RC = detection + response — potential partner, not just competitor",
    ],
    urgencyLevel: "low",
  },

  // ── Venue ────────────────────────────────────────────────────────────────
  {
    id: "247software",
    name: "24/7 Software",
    aliases: ["247software.com", "24/7 incident management", "247 Software"],
    verticals: ["venue"],
    products: ["24/7 Software Platform", "Incident Management", "Guest Assistance"],
    hq: "Boca Raton, FL",
    funding: "Private Equity-backed",
    recentNews: "Platinum sponsor at Secure Venues Summit 2026 (Sept 28, Seattle).",
    displacementNotes:
      "The dominant venue incident management platform. PE ownership driving price increases. No 911 integration. Staff-only model — no guest-facing QR reporting.",
    rcAdvantages: [
      "RC connects venue incidents to 911 — 24/7 Software does not",
      "RC QR/NFC guest reporting gives RC data 24/7 Software never sees",
      "RC camera integration provides live situational awareness 24/7 lacks",
      "US veteran-owned vs. PE-owned pricing pressure",
    ],
    urgencyLevel: "high",
  },
  {
    id: "raven",
    name: "Raven Controls",
    aliases: ["ravencontrols.com", "Raven Eye", "raven venue"],
    verticals: ["venue"],
    products: [
      "Raven Controls Platform",
      "Raven Eye",
      "Incident Management",
      "Operations Checklists",
    ],
    hq: "Glasgow, Scotland (UK)",
    funding: "Venture-backed (Scottish Enterprise, Grow London, Scottish EDGE)",
    recentNews:
      "Bronze sponsor at Secure Venues Summit 2026 (Sept 28, Seattle). Expanding aggressively into US market from UK base. Key US customers: Target Center (NBA), NYCFC, NY Red Bulls.",
    displacementNotes:
      "UK-based company expanding into US. Support time zone gap for live US events is real operational risk. No 911 integration. Primarily staff-facing — no guest-side reporting.",
    rcAdvantages: [
      "RC is US-based — live support during US event hours",
      "RC connects directly to 911 dispatch — Raven does not",
      "RC QR guest reporting vs. Raven's staff-only model",
      "RC is veteran-owned and CJIS-aware — matters for agency partnerships",
    ],
    urgencyLevel: "high",
  },
  {
    id: "inorbit",
    name: "inOrbit",
    aliases: ["inorbit.com", "Security Program Management"],
    verticals: ["venue"],
    products: ["inOrbit Security Program Management Software"],
    hq: "United States",
    funding: "Private",
    recentNews:
      "Bronze sponsor at Secure Venues Summit 2026. Founded by Akmal Ali (former DHS SAFETY Act). Speaker at VNC 2026.",
    displacementNotes:
      "Security compliance and program management tool. Not an incident response platform — complements rather than competes.",
    rcAdvantages: [
      "RC and inOrbit are complementary — inOrbit manages the program, RC executes it",
      "Potential integration or referral partnership opportunity",
    ],
    urgencyLevel: "low",
  },
  {
    id: "convergint",
    name: "Convergint",
    aliases: ["convergint.com"],
    verticals: ["venue"],
    products: ["Security Integration Services", "Physical Security"],
    hq: "Schaumburg, IL",
    funding: "Private Equity (Ares Management)",
    recentNews: "Exhibitor Partner at Secure Venues Summit 2026.",
    displacementNotes:
      "Systems integrator — installs hardware. RC software sits on top of what Convergint installs. More partner than competitor.",
    rcAdvantages: [
      "RC is the software layer above Convergint's hardware installations",
      "Convergint partnership = RC deployed in every venue they service",
    ],
    urgencyLevel: "low",
  },
];

/** Flat list of brand names for legacy callers / simple includes checks. */
export const KNOWN_COMPETITORS: string[] = [
  ...new Set(COMPETITOR_REGISTRY.flatMap((c) => [c.name, ...c.aliases])),
];

export const ALL_COMPETITOR_NAMES: string[] = KNOWN_COMPETITORS;

export const HIGH_URGENCY_COMPETITORS: string[] = COMPETITOR_REGISTRY.filter(
  (c) => c.urgencyLevel === "high",
).flatMap((c) => [c.name, ...c.aliases]);

export function findCompetitor(name: string): Competitor | null {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;
  return (
    COMPETITOR_REGISTRY.find(
      (c) =>
        c.name.toLowerCase() === lower ||
        c.aliases.some((a) => a.toLowerCase() === lower),
    ) ?? null
  );
}

/** Prefer parent brand for acquired subsidiaries (Carbyne/Prepared → Axon). */
export function resolveIncumbentBrand(name: string): string {
  const found = findCompetitor(name);
  if (!found) return name.trim();
  if (found.id === "carbyne" || found.id === "prepared") {
    return "Axon";
  }
  // Alias hit on Axon entry (e.g. "Carbyne" matched Axon first) already returns Axon.
  return found.name;
}

export function extractMentionedCompetitors(text: string): Competitor[] {
  const lower = text.toLowerCase();
  return COMPETITOR_REGISTRY.filter((c) => {
    if (lower.includes(c.name.toLowerCase())) return true;
    if (c.aliases.some((alias) => alias.length >= 3 && lower.includes(alias.toLowerCase()))) {
      return true;
    }
    return c.products.some((p) => p.length > 4 && lower.includes(p.toLowerCase()));
  });
}

export function isKnownCompetitor(vendor: string | null | undefined): boolean {
  const v = vendor?.trim().toLowerCase() ?? "";
  if (!v) return false;
  if (findCompetitor(vendor ?? "")) return true;
  return KNOWN_COMPETITORS.some((c) => v.includes(c.toLowerCase()));
}

export function estimateContractExpiry(
  _incumbentVendor: string,
  lastSignalDate: string,
): { expiryYear: number | null; urgency: "high" | "medium" | "low" } {
  const signalYear = new Date(lastSignalDate).getFullYear();
  if (Number.isNaN(signalYear)) {
    return { expiryYear: null, urgency: "medium" };
  }
  return {
    expiryYear: signalYear + 1,
    urgency: "high",
  };
}

export function getDisplacementScore(
  opp: Pick<
    RapidIqOpportunity,
    "incumbentVendor" | "intentStage" | "contractExpirySignal" | "opportunityScore"
  >,
): number {
  if (!isKnownCompetitor(opp.incumbentVendor)) return 0;

  let score = 50;
  if (opp.intentStage === "active_rfp") score += 30;
  if (opp.intentStage === "evaluation") score += 20;
  if (opp.contractExpirySignal) score += 15;
  if (opp.opportunityScore >= 80) score += 5;

  const brand = opp.incumbentVendor ? resolveIncumbentBrand(opp.incumbentVendor) : "";
  const competitor = findCompetitor(brand) ?? findCompetitor(opp.incumbentVendor ?? "");
  if (competitor?.urgencyLevel === "high") score += 10;

  return Math.min(score, 100);
}

export function rcProductForCompetitor(competitor: Competitor): "core" | "campus" | "venue" {
  const primary = competitor.verticals[0];
  if (primary === "venue") return "venue";
  if (primary === "campus") return "campus";
  return "core";
}

export function verticalForCompetitor(competitor: Competitor): "911" | "campus" | "venue" {
  const primary = competitor.verticals[0];
  if (primary === "venue" || primary === "campus") return primary;
  return "911";
}
