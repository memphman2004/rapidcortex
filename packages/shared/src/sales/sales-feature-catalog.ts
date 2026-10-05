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
  /** Short card summary (1–2 sentences). */
  explanation: string;
  /** In-depth definition for sales enablement / Pricing Catalog detail. */
  detail: string;
  /** Buyer-value line — what to emphasize on a call. */
  buyerValue: string;
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
      "Permanent free tip line for qualifying institutions: one QR code, one physical zone, tip submissions forwarded to a designated email.",
    detail:
      "A permanent complimentary offering for qualifying campus and venue prospects. The institution gets one QR code tied to one physical zone; tips route to a designated inbox. There is no dispatcher console, analytics, two-way chat, AI triage, or Clery log. Use it as a land-and-expand wedge — prove reporting adoption, then upsell the full tip console, multi-zone QR/NFC, and analytics.",
    buyerValue: "Zero-friction proof of QR reporting adoption before a paid contract.",
    compatibleVerticals: ["campus", "venue"],
    isFree: true,
    freeKind: "permanent",
    category: "Free offerings",
  },
  {
    id: "agency_intelligence_scan",
    name: "Complimentary Operational Intelligence Report",
    explanation:
      "One-time service: agency provides 30–60 days of anonymized CAD export; deliver a 3–5 page operational intelligence PDF.",
    detail:
      "Prospect provides 30–60 days of anonymized CAD export (call type, timestamp, duration — no PII). NexCort delivers a short PDF covering volume by hour, call-type mix, language share, peak load windows, and rough admin-time estimates. Limited availability — treat as a discovery accelerator for PSAP directors and IT sponsors, not a standing deliverable on every deal.",
    buyerValue: "Turns their own CAD data into a quantified pain story before the demo.",
    compatibleVerticals: ["all"],
    isFree: true,
    freeKind: "one_time_service",
    category: "Free offerings",
  },
  {
    id: "dispatcher_wellness",
    name: "NexCort iQ Wellness",
    explanation:
      "Permanent free anonymous end-of-shift check-in for dispatchers; supervisors see aggregate wellness only.",
    detail:
      "A 60-second anonymous end-of-shift check-in for telecommunicators. Supervisors see aggregate wellness trends only — never individual responses, call data, or transcripts. No CJIS exposure. Free for accredited PSAPs. Position as workforce retention and duty-of-care support that builds goodwill without requiring a full platform purchase.",
    buyerValue: "Shows you care about dispatcher wellness — without touching call data or CJIS scope.",
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
      "Real-time call transcription for dispatchers — every word captured as the call happens. Core differentiator; never free.",
    detail:
      "Streams word-by-word speech-to-text into the live dispatcher workspace so telecommunicators do not rely on memory or fragmented notes. Transcripts feed AI coaching, disposition summaries, QA scorecards, and audit trails. Position as the foundation layer: without live transcription, most AI value collapses. Never bundle as complimentary on a pilot or order.",
    buyerValue: "Every word captured in real time — no post-call recall required.",
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
    detail:
      "While the call is live, AI reads the transcript and surfaces triage hints, protocol reminders, SOP steps, and confidence signals. The dispatcher stays in control — suggestions are advisory, never autonomous actions. Pair with live transcription in every Professional+ narrative. Never offer as free; it is a core paid differentiator.",
    buyerValue: "Reduces cognitive load mid-call without removing human judgment.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    neverFree: true,
    category: "911 Centers / PSAPs",
  },
  {
    id: "cad_writeback",
    name: "CAD write-back",
    explanation:
      "Assisted or automated CAD write-back after dispatcher review. Requires signed agency addendum. Never free.",
    detail:
      "Optional path to post NexCort-assisted CAD fields into the agency’s native CAD after explicit dispatcher review and approval. Fail-closed by default across product, API, and infrastructure. Requires a signed CAD write-back addendum and scoped discovery (vendor, nature codes, environments). Never include full write-back in pilot base pricing — sell discovery first, then write-back as a controlled expansion.",
    buyerValue: "Dispatcher-reviewed CAD posting — never silent automation into the system of record.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    neverFree: true,
    category: "CAD Integration",
  },
  {
    id: "cad_readonly",
    name: "CAD read-only integration",
    explanation:
      "One-way read from agency CAD into the NexCort iQ context panel — enrich the call without touching CAD writes.",
    detail:
      "Ingests CAD activity one-way so the dispatcher sees unit status, nature codes, and related context inside NexCort while the call is live. No write path into CAD. Best first integration step for every PSAP — works alongside Tyler, CentralSquare, Hexagon, Spillman, and similar systems with read access only. Use this to prove value before scoping write-back.",
    buyerValue: "CAD context in the intelligence layer — zero risk to the CAD system of record.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    category: "CAD Integration",
  },
  {
    id: "transcription_translation",
    name: "Transcription & translation",
    explanation:
      "Multi-language transcription and live translation assist for telecommunicators across 911, campus, and venue.",
    detail:
      "Combines live speech-to-text with bidirectional translation assist so a single telecommunicator can work a non-English caller without parking on an interpreter bridge. Available for PSAP consoles and campus/venue ops where language barriers delay intake. Emphasize hold-time elimination and equity of access — do not guarantee a fixed language mix unless discovery confirmed it.",
    buyerValue: "One seat handles any language — no interpreter hold, no third party on the call.",
    compatibleVerticals: ["rc911", "campus", "venue"],
    isFree: false,
    category: "Language",
  },
  {
    id: "caller_media",
    name: "Caller media intake",
    explanation:
      "Secure intake of photos, video, and location media from callers or field units via SMS link — no app required.",
    detail:
      "Callers and field reporters receive a secure SMS/web link to upload photos, short video, and location media into the incident record. No citizen app install. Media lands in the console with audit trail before units arrive. Strong proof point for domestic violence, fire, MVC, campus tips, and venue fan reports where visual evidence changes priority in the first minutes.",
    buyerValue: "Scene evidence before units arrive — no app download for the public.",
    compatibleVerticals: ["rc911", "campus", "venue", "transit"],
    isFree: false,
    category: "Media",
  },
  {
    id: "supervisor_qa",
    name: "Supervisor QA & coaching",
    explanation:
      "QA scorecards, coaching workflows, and post-incident review tools for ECC supervisors.",
    detail:
      "Gives supervisors structured scorecards, coaching notes, and post-incident review tied to the live transcript and call timeline. Replaces ad-hoc random review with a consistent rubric. Sell to QA supervisors and training coordinators who need measurable coaching without waiting for end-of-month sampling.",
    buyerValue: "Coach during and after the call — not weeks later from memory.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    category: "Quality",
  },
  {
    id: "api_access",
    name: "API access",
    explanation:
      "Programmatic API access for agency integrations, reporting pipelines, and partner systems.",
    detail:
      "Documented HTTP APIs for agencies that need to pull incidents, status, or reporting data into existing BI, records, or middleware stacks. Scoped by agency and role. Position for IT directors after product fit is clear — not as the opening pitch. Confirm rate limits and data classes in the SOW.",
    buyerValue: "Fits their existing reporting and integration stack — not a closed island.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Platform",
  },
  {
    id: "premium_support",
    name: "Premium support",
    explanation:
      "Elevated support SLAs and a named success contact for production agencies.",
    detail:
      "Elevated response targets, prioritized ticket handling, and a named customer-success contact. Often included in Professional+; sell as an add-on for Essential or special deployments that need after-hours coverage. Do not invent SLA numbers not in the current SOW template.",
    buyerValue: "A named human when the ECC needs answers — not a black-hole ticket queue.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Support",
  },
  {
    id: "team_dashboards",
    name: "Team performance dashboards",
    explanation:
      "Shift and team KPIs for supervisors and agency leadership across PSAP, campus, venue, and transit.",
    detail:
      "Operational dashboards for shift volume, response intervals, tip/incident mix, and team workload. Built for supervisors and agency leadership — not a public dashboard. Use in demos after live ops so the buyer sees how day-to-day management works after go-live.",
    buyerValue: "Leadership sees workload and trends without pulling CAD extracts by hand.",
    compatibleVerticals: ["rc911", "campus", "venue", "transit"],
    isFree: false,
    category: "Analytics",
  },
  {
    id: "command_dashboard",
    name: "Command dashboard & war rooms",
    explanation:
      "Command-level situational awareness and war-room collaboration for major incidents.",
    detail:
      "Command and war-room surfaces for MCI, weather events, campus crises, and venue emergencies. Shared situational awareness across authorized roles without putting every stakeholder into the live dispatcher seat. Core to Command-tier narratives. Confirm whether the prospect needs public/stakeholder status pages as a related add-on.",
    buyerValue: "One shared picture for command staff when the incident outgrows a single console.",
    compatibleVerticals: ["rc911", "campus", "venue"],
    isFree: false,
    category: "Command",
  },
  {
    id: "tip_console",
    name: "Security / tip console",
    explanation:
      "Full tip inbox with two-way chat, assignment, and status tracking — beyond free email-only Community Connect.",
    detail:
      "Paid tip/security inbox for campus, venue, and transit: assignment, status workflow, two-way SMS/chat, and operator console. Distinct from Community Connect (email-only free tip). This is the upsell path after a free tip line proves adoption. Emphasize no-app citizen reporting plus closed-loop response.",
    buyerValue: "Tips become managed work — assigned, answered, and closed — not a forgotten inbox.",
    compatibleVerticals: ["campus", "venue", "transit"],
    isFree: false,
    category: "Campus & Venue",
  },
  {
    id: "clery_documentation",
    name: "Clery documentation log",
    explanation:
      "Clery Act documentation and daily crime log workflows for higher-education campuses.",
    detail:
      "Higher-ed Clery workflows: review queue, Daily Crime Log (shown as Daily Incident Log in product), and ASR-oriented documentation paths. K-12 uses Daily Incident Log and School Safety Report — do not sell Clery ASR language to K-12. Advanced Clery Reporting may be a separate add-on; confirm before quoting.",
    buyerValue: "Compliance documentation stays tied to the same incidents security already works.",
    compatibleVerticals: ["campus"],
    isFree: false,
    category: "Campus & Venue",
  },
  {
    id: "multi_qr_zones",
    name: "Multi-zone QR / NFC",
    explanation:
      "More than one QR zone plus NFC tag support for campus, venue, and transit sites.",
    detail:
      "Expands beyond a single Community Connect zone: multiple physical zones, seat/section/gate mapping, and NFC tags alongside QR. Critical for stadiums, multi-building campuses, and transit fleets where location context must be pre-filled. Sell with tip console and media intake as the no-app reporting stack.",
    buyerValue: "Every scan knows where it came from — seat, building, vehicle, or gate.",
    compatibleVerticals: ["campus", "venue", "transit"],
    isFree: false,
    category: "Campus & Venue",
  },
  {
    id: "tip_analytics",
    name: "Tip & incident analytics",
    explanation:
      "Trend analytics and reporting on tip volume, types, and response times for campus, venue, and transit.",
    detail:
      "Analytics on tip and incident volume, categories, hotspots, and response intervals. Helps safety directors justify staffing and prove program ROI to boards. Demo after the tip console so the buyer sees the operating loop end-to-end.",
    buyerValue: "Board-ready trends without exporting spreadsheets every Friday.",
    compatibleVerticals: ["campus", "venue", "transit"],
    isFree: false,
    category: "Analytics",
  },
  {
    id: "hospital_capacity",
    name: "Hospital capacity portal",
    explanation:
      "Live ER capacity, diversion status, and EMS pre-alert coordination for hospitals and PSAPs.",
    detail:
      "Hospital-facing capacity and diversion board plus EMS pre-alert intake so receiving facilities see inbound patients earlier. Useful in regional MCI and day-to-day EMS routing conversations. Roles are hospital-scoped (admin/staff; confirm coordinator assignability before promising). Pair with Mutual Aid & MCI when selling regional readiness.",
    buyerValue: "EMS and the ED share one capacity picture before the ambulance bay fills.",
    compatibleVerticals: ["hospital", "rc911"],
    isFree: false,
    category: "Hospital",
  },
  {
    id: "transit_ops",
    name: "Transit operations console",
    explanation:
      "Route/zone ops, passenger reports, and transit security workflows for bus, rail, and ferry systems.",
    detail:
      "Transit security and ops console covering passenger QR/NFC reports, vehicle/route context, operator views, and security workflows. Built for transit authorities — not a rebranded PSAP dispatcher seat. Lead with rider reporting friction and fleet coverage, then cameras and SOPs.",
    buyerValue: "Rider reports land on the right vehicle and route — not a generic inbox.",
    compatibleVerticals: ["transit"],
    isFree: false,
    category: "Transit",
  },
  {
    id: "onsite_deployment_training",
    name: "Onsite deployment & training",
    explanation:
      "Onsite implementation and training package for go-live with agency staff.",
    detail:
      "Hands-on onsite configuration, floor training, and go-live support. Use when agencies need change-management help or multi-shift training that remote sessions cannot cover. Scope travel, number of shifts, and train-the-trainer expectations in the SOW.",
    buyerValue: "Your people go live with trainers on the floor — not a PDF and a prayer.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Implementation",
  },
  {
    id: "setup_implementation_fee",
    name: "Setup & implementation",
    explanation:
      "Remote setup, configuration, and implementation services for agency go-live.",
    detail:
      "Remote implementation: environment setup, role configuration, integrations scoped in the SOW, and admin training. Standard path for most pilots and Essential/Professional deals. Keep CAD write-back and complex radio/camera work as separate line items when discovery is incomplete.",
    buyerValue: "Configured and ready before the first live shift — not a DIY install.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Implementation",
  },

  // ── Product surfaces often missing from older catalogs ────────────────────
  {
    id: "call_assist",
    name: "Call Assist (non-emergency)",
    explanation:
      "AI-assisted non-emergency call intake with greeting flows, callbacks, and operator console — separate from 911 dispatch.",
    detail:
      "Standalone non-emergency product (Amazon Connect + Lex + Bedrock + Polly). Handles greeting, classification, callbacks, and operator console work. Emergency mid-call handoff uses a hardcoded TRANSFER_911 path that cannot be suppressed. Users land on /app/call-assist/* — never the 911 dispatcher workspace. Sell for non-emergency volume reduction alongside NC 911, not as a replacement for 911.",
    buyerValue: "Takes non-emergency load off the ECC without putting AI on the 911 console.",
    compatibleVerticals: ["rc911", "campus", "venue", "transit"],
    isFree: false,
    category: "Call Assist",
  },
  {
    id: "rapid_vision",
    name: "NexIQ Vision™",
    explanation:
      "Live camera assist (Ring, Nest, Wyze, Milestone), scene intelligence, and vision transcripts for authorized roles.",
    detail:
      "AI scene intelligence over live camera feeds — observations and vision transcripts delivered to authorized dispatcher/security roles. Supports agency cameras and citizen share paths (Ring/Nest/Wyze). Never free. Emphasize human-in-the-loop review and role gates; do not imply autonomous enforcement or facial-recognition promises unless product docs explicitly support the claim.",
    buyerValue: "The console sees what the camera sees — with AI observations, not a separate RTCC detour.",
    compatibleVerticals: ["rc911", "campus", "venue", "transit"],
    isFree: false,
    neverFree: true,
    category: "Vision & Cameras",
  },
  {
    id: "rapid_iq",
    name: "NexiQ sales & RFP intelligence",
    explanation:
      "Internal PSAP/RFP signal pipeline, contact enrichment, and opportunity scoring for NexCort sales teams.",
    detail:
      "Internal sales-intelligence workspace (NexiQ): RFP/PSAP signals, contact enrichment, and opportunity scoring. Not an agency-facing SKU for end customers — do not sell this to PSAPs as a product. Used by NexCort sales contractors and RC operators inside the sales portal / RC Admin allowlist.",
    buyerValue: "Internal only — helps you find and prioritize deals; not a customer deliverable.",
    compatibleVerticals: ["all"],
    isFree: false,
    category: "Sales Intelligence",
  },
  {
    id: "rc_translate",
    name: "NexCort Translate",
    explanation:
      "Field, venue, campus, and clinical voice translation sessions for non-911 and ops consoles.",
    detail:
      "Translation sessions for field/ops contexts outside the classic 911 telecommunicator bridge — campus security, venue guest services, transit operators, and clinical coordination. Complements PSAP NC Translate. Sell when the buyer’s language pain is at the point of contact with the public, not only in the ECC.",
    buyerValue: "Language access where the public is standing — not only on the 911 line.",
    compatibleVerticals: ALL,
    isFree: false,
    category: "Language",
  },
  {
    id: "cad_mesh",
    name: "CAD-to-CAD mesh",
    explanation:
      "Cross-agency CAD mesh sharing for mutual aid and regional partners. Never free.",
    detail:
      "Regional CAD-to-CAD mesh for mutual aid partners that need shared incident awareness across agency boundaries. High-trust, high-complexity — requires careful scoping, consent, and dual-admin patterns similar to Agency Share. Never free. Do not promise mesh go-live inside a single-agency pilot.",
    buyerValue: "Regional partners see the same incident picture when mutual aid activates.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    neverFree: true,
    category: "CAD Integration",
  },
  {
    id: "mutual_aid_mci",
    name: "Mutual Aid & MCI Command",
    explanation:
      "Mutual aid coordination and multi-casualty incident command tooling for PSAPs and hospitals.",
    detail:
      "Command tooling for mutual aid activation and MCI coordination across PSAP and hospital participants. Complements war rooms and hospital capacity. Sell into regional readiness conversations and grant-funded MCI modernization — confirm which roles and agencies are in scope before demoing.",
    buyerValue: "When the incident spans agencies, command still has one coordinated playbook.",
    compatibleVerticals: ["rc911", "hospital"],
    isFree: false,
    category: "Command",
  },
  {
    id: "connect_nest_wyze",
    name: "Nest / Wyze Connect",
    explanation:
      "Citizen Nest and Wyze camera share flows alongside Ring Connect into the incident console.",
    detail:
      "Citizen camera share for Nest and Wyze (alongside Ring) so callers or residents can grant time-limited live view into the incident. Complements agency NC Connect camera integration. Strong for residential 911 and campus residential life scenarios. Keep privacy/consent language accurate — temporary share, not permanent surveillance takeover.",
    buyerValue: "Home and campus cameras join the incident when the citizen consents — no truck roll first.",
    compatibleVerticals: ["rc911", "campus", "venue"],
    isFree: false,
    category: "Vision & Cameras",
  },
  {
    id: "ng911_assist",
    name: "NG911 Assist",
    explanation:
      "Diversion, EIDO, Additional Data, and NG911 metrics assist packs for i3-aware PSAPs.",
    detail:
      "Assists NG911 / i3-aware agencies with diversion, EIDO/additional data, and NG911 metrics packs. Position for PSAPs mid-NG911 upgrade — not as a telephony rip-and-replace. Confirm the agency’s ESInet / i3 readiness in discovery before promising data flows.",
    buyerValue: "Meets them where their NG911 program is — without replacing the call path.",
    compatibleVerticals: ["rc911"],
    isFree: false,
    category: "911 Centers / PSAPs",
  },
  {
    id: "venue_guest_services",
    name: "Venue Guest Services console",
    explanation:
      "Non-911 venue guest-services ops console (orange-branded) — explicitly not a 911 dispatch system.",
    detail:
      "Orange-branded guest-services console for VENUE_GUEST_SERVICES and related venue ops. Handles guest issues, wayfinding, and non-emergency venue workflows. Every page should reinforce it is not a 911 emergency dispatch system. Sell to venue GMs who need guest ops separate from security command.",
    buyerValue: "Guest services get their own console — security keeps the emergency stack.",
    compatibleVerticals: ["venue"],
    isFree: false,
    category: "Campus & Venue",
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
