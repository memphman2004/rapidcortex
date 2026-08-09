import type {
  IntentStage,
  MentionedEntity,
  RapidIqContact,
  RapidIqOpportunity,
  RapidIqSignal,
  RapidIqSource,
  RapidIqVertical,
  RefreshStatus,
} from "./types";
import type { OpportunityListParams } from "./types";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const REFRESHED = daysAgo(0);

function opp(
  partial: Omit<RapidIqOpportunity, "lastRefreshedAt" | "detectedAt"> & {
    detectedDaysAgo?: number;
  },
): RapidIqOpportunity {
  const detectedAt = daysAgo(partial.detectedDaysAgo ?? 3);
  const { detectedDaysAgo: _, ...rest } = partial;
  return { ...rest, detectedAt, lastRefreshedAt: REFRESHED };
}

export const DEMO_OPPORTUNITIES: RapidIqOpportunity[] = [
  opp({
    opportunityId: "demo-fl-desoto-911",
    vertical: "911",
    rcProduct: "core",
    agencyName: "DeSoto County ECC",
    agencyType: "county_911",
    city: "Arcadia",
    state: "FL",
    county: "DeSoto",
    population: 36744,
    opportunityScore: 95,
    fitScore: 88,
    intentStage: "active_rfp",
    estimatedDecisionDays: 45,
    incumbentVendor: "Hexagon",
    contractExpirySignal: true,
    estimatedDollarValue: 850_000,
    dollarValueSource: "Board agenda line item",
    aiHeadline: "DeSoto County ECC soliciting next-gen CAD/911 platform replacement",
    aiSummary:
      "Commission minutes authorize $850K for ECC modernization including CAD replacement and NG911-ready recording. Rapid Cortex core aligns with their stated need for AI-assisted call handling and supervisor visibility without full CAD rip-and-replace.",
    talkingPoints: [
      "Reference the $850K board authorization — position RC as AI layer that extends existing CAD investment.",
      "Hexagon contract expiry creates a 90-day evaluation window; offer parallel pilot on live traffic.",
      "DeSoto's rural footprint makes cloud-first deployment attractive vs. on-prem refresh.",
      "Highlight Ring Connect and field video for deputy mutual aid — adjacent county references.",
      "Offer grant packaging support — Florida 911 State Grant cycle opens Q4.",
    ],
    signalCount: 3,
    lastSignalAt: daysAgo(1),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["RFP LIVE", "NG911", "PSAP SOFTWARE"],
    isActNow: true,
    detectedDaysAgo: 1,
  }),
  opp({
    opportunityId: "demo-wv-upshur-911",
    vertical: "911",
    rcProduct: "core",
    agencyName: "Upshur County 911",
    agencyType: "county_911",
    city: "Buckhannon",
    state: "WV",
    county: "Upshur",
    population: 24623,
    opportunityScore: 92,
    fitScore: 82,
    intentStage: "evaluation",
    estimatedDecisionDays: 60,
    incumbentVendor: "Motorola Solutions",
    contractExpirySignal: false,
    estimatedDollarValue: 420_000,
    dollarValueSource: "Budget workshop transcript",
    aiHeadline: "Upshur County evaluating NG911 recording and analytics stack",
    aiSummary:
      "Budget workshop discusses $420K NG911 readiness including recording analytics and quality assurance. Rapid Cortex QA scoring and supervisor coaching map directly to their stated compliance goals.",
    talkingPoints: [
      "Lead with automated QA — Upshur explicitly mentioned recording review backlog.",
      "Motorola incumbent suggests integration-first pitch, not rip-and-replace.",
      "Reference WV NG911 statewide timeline — position RC as acceleration layer.",
      "Offer supervisor wellness + coaching bundle for small-center staffing pain.",
      "Pilot proposal: 30-day QA scoring on archived calls before procurement vote.",
    ],
    signalCount: 2,
    lastSignalAt: daysAgo(2),
    status: "watching",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["NG911", "OPPORTUNITY"],
    isActNow: true,
    detectedDaysAgo: 2,
  }),
  opp({
    opportunityId: "demo-ga-fulton-911",
    vertical: "911",
    rcProduct: "core",
    agencyName: "Fulton County ECC",
    agencyType: "county_911",
    city: "Atlanta",
    state: "GA",
    county: "Fulton",
    population: 1066710,
    opportunityScore: 78,
    fitScore: 75,
    intentStage: "awareness",
    estimatedDecisionDays: 120,
    incumbentVendor: "CentralSquare",
    contractExpirySignal: false,
    estimatedDollarValue: 2_400_000,
    dollarValueSource: "Capital improvement plan",
    aiHeadline: "Fulton County CIP includes $2.4M public safety communications line",
    aiSummary:
      "Five-year capital plan allocates $2.4M for ECC technology refresh. No RFP yet — early relationship window for Rapid Cortex AI intelligence layer ahead of formal solicitation.",
    talkingPoints: [
      "Fulton is Tier-0 market — prioritize executive briefing with ECC director.",
      "CentralSquare footprint suggests CAD-adjacent positioning.",
      "Reference Columbus HQ proximity for on-site discovery.",
      "Cross-sell campus vertical for Atlanta universities in same county.",
      "Monitor commission agendas weekly — RFP likely within 6 months.",
    ],
    signalCount: 2,
    lastSignalAt: daysAgo(5),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["OPPORTUNITY", "CAD INTEGRATION"],
    isActNow: false,
    detectedDaysAgo: 5,
  }),
  opp({
    opportunityId: "demo-al-mobile-911",
    vertical: "911",
    rcProduct: "core",
    agencyName: "Mobile County Communications District",
    agencyType: "regional_center",
    city: "Mobile",
    state: "AL",
    county: "Mobile",
    population: 414809,
    opportunityScore: 71,
    fitScore: 68,
    intentStage: "evaluation",
    estimatedDecisionDays: 90,
    incumbentVendor: "Tyler Technologies",
    contractExpirySignal: true,
    estimatedDollarValue: 1_100_000,
    dollarValueSource: "RFP attachment estimate",
    aiHeadline: "Mobile County exploring CAD analytics and supervisor tools add-on",
    aiSummary:
      "Procurement posting references CAD analytics module with $1.1M estimated value. Rapid Cortex supervisor performance and SLA backlog features address stated operational gaps.",
    talkingPoints: [
      "Tyler CAD write-back integration is a differentiator — emphasize read-only pilot first.",
      "Mobile's port logistics create surge-event use case for war rooms.",
      "AL neighboring agencies — reference regional center consolidation trend.",
      "Grant funding angle: COPS technology program alignment.",
      "Schedule discovery with comm district board liaison before Q&A deadline.",
    ],
    signalCount: 2,
    lastSignalAt: daysAgo(4),
    status: "reviewed",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["COMPETITOR", "CAD INTEGRATION"],
    isActNow: false,
    detectedDaysAgo: 4,
  }),
  opp({
    opportunityId: "demo-ga-uga-campus",
    vertical: "campus",
    rcProduct: "campus",
    agencyName: "University of Georgia",
    agencyType: "university",
    city: "Athens",
    state: "GA",
    county: "Clarke",
    population: 40118,
    opportunityScore: 84,
    fitScore: 86,
    intentStage: "evaluation",
    estimatedDecisionDays: 75,
    incumbentVendor: null,
    contractExpirySignal: false,
    estimatedDollarValue: 650_000,
    dollarValueSource: "USG board minutes",
    aiHeadline: "UGA Public Safety reviewing unified campus dispatch intelligence platform",
    aiSummary:
      "Board of Regents discussion cites $650K for campus safety technology including Clery reporting automation. Rapid Cortex Campus vertical covers dispatch assist, QR locations, and Clery ASR workspace.",
    talkingPoints: [
      "UGA is flagship GA campus — use as reference for USG system-wide deal.",
      "Clery ASR workspace is immediate wedge vs. generic mass notification vendors.",
      "QR location registry for dorm complexes — demo with existing campus pack.",
      "Game-day surge aligns with venue module cross-sell for Sanford Stadium.",
      "Offer semester pilot tied to football season kickoff.",
    ],
    signalCount: 2,
    lastSignalAt: daysAgo(3),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["OPPORTUNITY", "GRANT FUNDING"],
    isActNow: false,
    detectedDaysAgo: 3,
  }),
  opp({
    opportunityId: "demo-ga-gt-campus",
    vertical: "campus",
    rcProduct: "campus",
    agencyName: "Georgia Tech Police Department",
    agencyType: "university",
    city: "Atlanta",
    state: "GA",
    county: "Fulton",
    population: 45000,
    opportunityScore: 76,
    fitScore: 80,
    intentStage: "awareness",
    estimatedDecisionDays: null,
    incumbentVendor: "Rave Mobile Safety",
    contractExpirySignal: false,
    estimatedDollarValue: 380_000,
    dollarValueSource: "Budget request narrative",
    aiHeadline: "Georgia Tech capital request flags emergency comms modernization",
    aiSummary:
      "Capital request mentions $380K for emergency communications modernization. Incumbent Rave contract renewal in 18 months — early displacement opportunity for Rapid Cortex campus console.",
    talkingPoints: [
      "Rave renewal timeline creates 12-month evaluation runway.",
      "Tech's urban campus needs CAD-adjacent situational awareness — not just alerts.",
      "Highlight integration with Atlanta PSAP for mutual aid incidents.",
      "Research lab security use case for restricted access buildings.",
      "Connect with GT Emergency Management director via USG peer intro.",
    ],
    signalCount: 1,
    lastSignalAt: daysAgo(6),
    status: "watching",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["COMPETITOR"],
    isActNow: false,
    detectedDaysAgo: 6,
  }),
  opp({
    opportunityId: "demo-sc-clemson-campus",
    vertical: "campus",
    rcProduct: "campus",
    agencyName: "Clemson University",
    agencyType: "university",
    city: "Clemson",
    state: "SC",
    county: "Pickens",
    population: 28000,
    opportunityScore: 68,
    fitScore: 72,
    intentStage: "awareness",
    estimatedDecisionDays: null,
    incumbentVendor: null,
    contractExpirySignal: false,
    estimatedDollarValue: 290_000,
    dollarValueSource: "Grant application draft",
    aiHeadline: "Clemson pursuing COPS campus safety grant for dispatch assist technology",
    aiSummary:
      "Grant draft references $290K for dispatch assist and location intelligence. Rapid Cortex grant success program can package narrative and budget justification.",
    talkingPoints: [
      "Offer Grant Success Program support for COPS application deadline.",
      "Football game-day coordination is Clemson's top operational pain point.",
      "QR wayfinding for Death Valley stadium perimeter.",
      "SC peer reference path through neighboring institutions.",
      "Pilot during spring semester before grant submission.",
    ],
    signalCount: 1,
    lastSignalAt: daysAgo(7),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["GRANT FUNDING"],
    isActNow: false,
    detectedDaysAgo: 7,
  }),
  opp({
    opportunityId: "demo-ga-mercedes-venue",
    vertical: "venue",
    rcProduct: "venue",
    agencyName: "Mercedes-Benz Stadium",
    agencyType: "venue",
    city: "Atlanta",
    state: "GA",
    county: "Fulton",
    population: null,
    opportunityScore: 88,
    fitScore: 90,
    intentStage: "evaluation",
    estimatedDecisionDays: 55,
    incumbentVendor: "Genetec",
    contractExpirySignal: true,
    estimatedDollarValue: 520_000,
    dollarValueSource: "Operations RFP scope",
    aiHeadline: "Mercedes-Benz Stadium RFP includes unified security operations center platform",
    aiSummary:
      "Venue operations RFP seeks $520K SOC platform integrating cameras, guest services, and emergency routing. Rapid Cortex Venue vertical with Ring Connect matches stated integration requirements.",
    talkingPoints: [
      "Genetec incumbent — position RC as intelligence layer atop VMS, not replacement.",
      "Falcons + Atlanta United dual-tenant complexity is key differentiator.",
      "Demo venue console with orange branding during off-season maintenance window.",
      "Guest services role isolation — emphasize NOT a 911 dispatch system messaging.",
      "Reference State Farm Arena peer in same market for multi-venue bundle.",
    ],
    signalCount: 2,
    lastSignalAt: daysAgo(2),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["RFP LIVE", "OPPORTUNITY"],
    isActNow: false,
    detectedDaysAgo: 2,
  }),
  opp({
    opportunityId: "demo-tn-nissan-venue",
    vertical: "venue",
    rcProduct: "venue",
    agencyName: "Nissan Stadium",
    agencyType: "venue",
    city: "Nashville",
    state: "TN",
    county: "Davidson",
    population: null,
    opportunityScore: 73,
    fitScore: 78,
    intentStage: "awareness",
    estimatedDecisionDays: null,
    incumbentVendor: null,
    contractExpirySignal: false,
    estimatedDollarValue: 410_000,
    dollarValueSource: "Metro council budget item",
    aiHeadline: "Metro Nashville budget line proposes stadium security intelligence upgrade",
    aiSummary:
      "Council budget includes $410K for Nissan Stadium security modernization ahead of major events calendar. Early outreach window before formal vendor selection.",
    talkingPoints: [
      "Titans season + concert series creates dual operational tempo.",
      "Tennessee E911 mutual aid — venue-to-PSAP handoff story.",
      "Ring Connect for perimeter camera federation.",
      "Offer Nashville demo during CMA Fest planning cycle.",
      "Bundle with Bridgestone Arena if Metro pursues city-wide venue contract.",
    ],
    signalCount: 1,
    lastSignalAt: daysAgo(8),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["OPPORTUNITY"],
    isActNow: false,
    detectedDaysAgo: 8,
  }),
  opp({
    opportunityId: "demo-fl-amway-venue",
    vertical: "venue",
    rcProduct: "venue",
    agencyName: "Amway Center",
    agencyType: "venue",
    city: "Orlando",
    state: "FL",
    county: "Orange",
    population: null,
    opportunityScore: 81,
    fitScore: 84,
    intentStage: "active_rfp",
    estimatedDecisionDays: 30,
    incumbentVendor: "Milestone",
    contractExpirySignal: true,
    estimatedDollarValue: 475_000,
    dollarValueSource: "Procurement portal posting",
    aiHeadline: "Amway Center active RFP for event security coordination platform",
    aiSummary:
      "City of Orlando procurement portal lists $475K RFP for event security coordination with AI-assisted incident routing. Rapid Cortex Venue Operator and Guest Services roles map to RFP functional requirements.",
    talkingPoints: [
      "RFP deadline within 30 days — prioritize proposal team assignment.",
      "Milestone VMS integration path — API-first architecture story.",
      "Orlando tourism volume — multilingual guest services angle.",
      "Cross-reference Orange County PSAP for E911 handoff compliance language.",
      "Offer live demo during Magic game off-night.",
    ],
    signalCount: 3,
    lastSignalAt: daysAgo(1),
    status: "new",
    convertedLeadId: null,
    assignedTo: null,
    notes: null,
    tags: ["RFP LIVE", "PSAP SOFTWARE"],
    isActNow: false,
    detectedDaysAgo: 1,
  }),
];

export const DEMO_SIGNALS: Record<string, RapidIqSignal[]> = {
  "demo-fl-desoto-911": [
    {
      signalId: "sig-desoto-1",
      opportunityId: "demo-fl-desoto-911",
      signalType: "meeting_minutes",
      title: "Board approves ECC modernization budget",
      summary: "Commission authorized $850K for ECC technology refresh including CAD replacement.",
      excerpt: "authorize expenditure not to exceed eight hundred fifty thousand",
      sourceName: "DeSoto County BCC",
      sourceType: "government_doc",
      sourceUrl: "https://www.desotocountyfl.gov/government/bcc/agendas",
      sourceDocUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      pageReference: "Agenda Item 7, p. 12",
      publishedAt: daysAgo(3),
      detectedAt: daysAgo(1),
      scoreContrib: 22,
    },
    {
      signalId: "sig-desoto-2",
      opportunityId: "demo-fl-desoto-911",
      signalType: "rfp",
      title: "CAD/911 platform RFP posted",
      summary: "Formal solicitation for next-generation CAD and recording platform.",
      excerpt: "request proposals for emergency communications center software",
      sourceName: "DeSoto Procurement",
      sourceType: "procurement_portal",
      sourceUrl: "https://www.desotocountyfl.gov/procurement",
      sourceDocUrl: null,
      pageReference: null,
      publishedAt: daysAgo(1),
      detectedAt: daysAgo(1),
      scoreContrib: 25,
    },
  ],
  "demo-wv-upshur-911": [
    {
      signalId: "sig-upshur-1",
      opportunityId: "demo-wv-upshur-911",
      signalType: "budget",
      title: "NG911 budget workshop discussion",
      summary: "County discusses $420K for NG911 recording and QA capabilities.",
      excerpt: "next generation nine one one recording analytics",
      sourceName: "Upshur County Commission",
      sourceType: "government_doc",
      sourceUrl: "https://upshurwv.org/commission/agendas",
      sourceDocUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      pageReference: "Workshop minutes, p. 4",
      publishedAt: daysAgo(5),
      detectedAt: daysAgo(2),
      scoreContrib: 20,
    },
  ],
  "demo-ga-mercedes-venue": [
    {
      signalId: "sig-mbs-1",
      opportunityId: "demo-ga-mercedes-venue",
      signalType: "rfp",
      title: "SOC platform RFP released",
      summary: "Stadium operations seeks unified security operations center software.",
      excerpt: "security operations center platform integrating video and guest services",
      sourceName: "AMB Group Operations",
      sourceType: "procurement_portal",
      sourceUrl: "https://www.mercedesbenzstadium.com/operations",
      sourceDocUrl: null,
      pageReference: "Section 3.2",
      publishedAt: daysAgo(4),
      detectedAt: daysAgo(2),
      scoreContrib: 24,
    },
  ],
};

export const DEMO_CONTACTS: Record<string, RapidIqContact[]> = {
  "demo-fl-desoto-911": [
    {
      contactId: "con-desoto-1",
      opportunityId: "demo-fl-desoto-911",
      name: "Sarah Mitchell",
      title: "ECC Director",
      roleTier: "primary",
      matchType: "exact",
      matchedOn: "911 Director",
      verificationStatus: "verified",
      verificationSource: "County staff directory",
      sourceCount: 3,
      verifiedAt: daysAgo(1),
      sourceUrl: "https://www.desotocountyfl.gov/directory",
      email: "smitchell@desotocountyfl.gov",
      emailVerified: true,
      phone: "(863) 555-0142",
      linkedInUrl: null,
    },
    {
      contactId: "con-desoto-2",
      opportunityId: "demo-fl-desoto-911",
      name: "Robert Chen",
      title: "Procurement Manager",
      roleTier: "procurement",
      matchType: "related",
      matchedOn: "Procurement",
      verificationStatus: "predicted",
      verificationSource: "Agenda signatory",
      sourceCount: 1,
      verifiedAt: null,
      sourceUrl: null,
      email: "rchen@desotocountyfl.gov",
      emailVerified: false,
      phone: null,
      linkedInUrl: null,
    },
  ],
  "demo-wv-upshur-911": [
    {
      contactId: "con-upshur-1",
      opportunityId: "demo-wv-upshur-911",
      name: "James Porter",
      title: "911 Coordinator",
      roleTier: "primary",
      matchType: "exact",
      matchedOn: "911 Director",
      verificationStatus: "verified",
      verificationSource: "WV 911 board listing",
      sourceCount: 2,
      verifiedAt: daysAgo(3),
      sourceUrl: "https://upshurwv.org",
      email: "jporter@upshurwv.org",
      emailVerified: true,
      phone: "(304) 555-0198",
      linkedInUrl: null,
    },
    {
      contactId: "con-upshur-2",
      opportunityId: "demo-wv-upshur-911",
      name: null,
      title: "County Commissioner",
      roleTier: "executive",
      matchType: "mentioned",
      matchedOn: "Commissioner",
      verificationStatus: "unverified",
      verificationSource: null,
      sourceCount: 0,
      verifiedAt: null,
      sourceUrl: null,
      email: null,
      emailVerified: false,
      phone: null,
      linkedInUrl: null,
    },
  ],
  "demo-ga-uga-campus": [
    {
      contactId: "con-uga-1",
      opportunityId: "demo-ga-uga-campus",
      name: "Dr. Amanda Reyes",
      title: "Chief of Police",
      roleTier: "primary",
      matchType: "exact",
      matchedOn: "Chief of Police",
      verificationStatus: "verified",
      verificationSource: "UGA Public Safety",
      sourceCount: 2,
      verifiedAt: daysAgo(2),
      sourceUrl: "https://police.uga.edu",
      email: "areyes@uga.edu",
      emailVerified: true,
      phone: "(706) 555-0177",
      linkedInUrl: null,
    },
  ],
  "demo-ga-mercedes-venue": [
    {
      contactId: "con-mbs-1",
      opportunityId: "demo-ga-mercedes-venue",
      name: "Marcus Williams",
      title: "Director of Security",
      roleTier: "primary",
      matchType: "exact",
      matchedOn: "Security Director",
      verificationStatus: "verified",
      verificationSource: "LinkedIn + RFP contact",
      sourceCount: 2,
      verifiedAt: daysAgo(1),
      sourceUrl: null,
      email: "mwilliams@ambgroup.com",
      emailVerified: true,
      phone: "(404) 555-0133",
      linkedInUrl: null,
    },
  ],
};

export const DEMO_SOURCES: Record<string, RapidIqSource[]> = {
  "demo-fl-desoto-911": [
    {
      sourceId: "src-desoto-1",
      opportunityId: "demo-fl-desoto-911",
      sourceRole: "primary",
      title: "BCC Meeting Agenda — ECC Modernization",
      url: "https://www.desotocountyfl.gov/government/bcc/agendas",
      docUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      documentType: "agenda_pdf",
      excerpt: "authorize expenditure not to exceed eight hundred fifty thousand dollars",
      pageReference: "Item 7, p. 12",
      publishedAt: daysAgo(3),
      retrievedAt: daysAgo(1),
    },
    {
      sourceId: "src-desoto-2",
      opportunityId: "demo-fl-desoto-911",
      sourceRole: "procurement",
      title: "CAD/911 Platform RFP",
      url: "https://www.desotocountyfl.gov/procurement",
      docUrl: null,
      documentType: "rfp",
      excerpt: "next-generation computer aided dispatch and recording system",
      pageReference: "Section 1.1",
      publishedAt: daysAgo(1),
      retrievedAt: daysAgo(1),
    },
  ],
  "demo-wv-upshur-911": [
    {
      sourceId: "src-upshur-1",
      opportunityId: "demo-wv-upshur-911",
      sourceRole: "budget",
      title: "Budget Workshop Transcript",
      url: "https://upshurwv.org/commission/agendas",
      docUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      documentType: "minutes_pdf",
      excerpt: "next generation nine one one recording analytics platform",
      pageReference: "p. 4",
      publishedAt: daysAgo(5),
      retrievedAt: daysAgo(2),
    },
  ],
  "demo-ga-mercedes-venue": [
    {
      sourceId: "src-mbs-1",
      opportunityId: "demo-ga-mercedes-venue",
      sourceRole: "primary",
      title: "SOC Platform RFP",
      url: "https://www.mercedesbenzstadium.com/operations",
      docUrl: null,
      documentType: "rfp",
      excerpt: "unified security operations center platform",
      pageReference: "Section 3.2",
      publishedAt: daysAgo(4),
      retrievedAt: daysAgo(2),
    },
  ],
};

export const DEMO_MENTIONED: Record<string, MentionedEntity[]> = {
  "demo-fl-desoto-911": [
    { name: "Hexagon Safety & Infrastructure", role: "Incumbent CAD vendor", status: "found", linkedContactId: null },
    { name: "Commissioner Davis", role: "Board sponsor", status: "searching", linkedContactId: null },
  ],
  "demo-wv-upshur-911": [
    { name: "Motorola Solutions", role: "Incumbent radio/recording", status: "found", linkedContactId: null },
  ],
  "demo-ga-uga-campus": [
    { name: "USG Board of Regents", role: "Funding authority", status: "found", linkedContactId: null },
    { name: "Clery Compliance Office", role: "Stakeholder", status: "not_found", linkedContactId: null },
  ],
};

export const DEMO_REFRESH_STATUS: RefreshStatus = {
  status: "complete",
  startedAt: daysAgo(0),
  completedAt: daysAgo(0),
  signalsFound: 12,
  error: null,
};

function matchesSearch(opp: RapidIqOpportunity, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    opp.agencyName.toLowerCase().includes(q) ||
    opp.aiHeadline.toLowerCase().includes(q) ||
    opp.city.toLowerCase().includes(q) ||
    opp.state.toLowerCase().includes(q) ||
    opp.county.toLowerCase().includes(q) ||
    opp.tags.some((t: string) => t.toLowerCase().includes(q))
  );
}

export function filterDemoOpportunities(params: OpportunityListParams = {}): RapidIqOpportunity[] {
  return DEMO_OPPORTUNITIES.filter((o) => {
    if (params.vertical && o.vertical !== params.vertical) return false;
    if (params.state && o.state !== params.state) return false;
    if (params.intentStage && o.intentStage !== params.intentStage) return false;
    if (params.search && !matchesSearch(o, params.search)) return false;
    return true;
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export function getDemoOpportunity(opportunityId: string): RapidIqOpportunity | null {
  return DEMO_OPPORTUNITIES.find((o) => o.opportunityId === opportunityId) ?? null;
}

export function getDemoSignals(opportunityId: string): RapidIqSignal[] {
  return DEMO_SIGNALS[opportunityId] ?? [];
}

export function getDemoContacts(opportunityId: string): RapidIqContact[] {
  return DEMO_CONTACTS[opportunityId] ?? [];
}

export function getDemoSources(opportunityId: string): RapidIqSource[] {
  return DEMO_SOURCES[opportunityId] ?? [];
}

export function getDemoMentioned(opportunityId: string): MentionedEntity[] {
  return DEMO_MENTIONED[opportunityId] ?? [];
}

export function demoStatsForVertical(vertical?: RapidIqVertical): {
  opportunities: number;
  rfps: number;
  competitor: number;
  grantFunding: number;
} {
  const items = vertical ? DEMO_OPPORTUNITIES.filter((o) => o.vertical === vertical) : DEMO_OPPORTUNITIES;
  return {
    opportunities: items.length,
    rfps: items.filter((o) => o.tags.includes("RFP LIVE")).length,
    competitor: items.filter((o) => o.tags.includes("COMPETITOR")).length,
    grantFunding: items.filter((o) => o.tags.includes("GRANT FUNDING")).length,
  };
}

export function demoSignalChatReply(
  opportunityId: string,
  message: string,
): string {
  const opp = getDemoOpportunity(opportunityId);
  if (!opp) return "I don't have context for this opportunity in demo mode.";
  const lower = message.toLowerCase();
  if (lower.includes("competitor") || lower.includes("incumbent")) {
    return `${opp.incumbentVendor ?? "No incumbent identified"} is the referenced vendor. Position Rapid Cortex as an AI intelligence layer that integrates with existing CAD/VMS rather than requiring full replacement.`;
  }
  if (lower.includes("dollar") || lower.includes("budget") || lower.includes("$")) {
    return `The estimated value is ${opp.estimatedDollarValue ? `$${opp.estimatedDollarValue.toLocaleString()}` : "not specified in source documents"}. Source: ${opp.dollarValueSource ?? "multiple signals"}.`;
  }
  if (lower.includes("timeline") || lower.includes("when")) {
    return opp.estimatedDecisionDays
      ? `Decision expected within ~${opp.estimatedDecisionDays} days based on ${opp.intentStage.replace("_", " ")} stage signals.`
      : "No firm decision timeline detected — relationship-building phase.";
  }
  return `For ${opp.agencyName}: ${opp.aiSummary.slice(0, 200)}… Ask about competitors, budget, timeline, or talking points for more detail.`;
}

export function demoTalkingPoints(opportunityId: string): string[] {
  const opp = getDemoOpportunity(opportunityId);
  return opp?.talkingPoints ?? [];
}
