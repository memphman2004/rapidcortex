export type IssueStatus = "published" | "upcoming";
export type Vertical = "psap" | "campus" | "transit" | "venue";

export interface VerticalNews {
  psap: string;
  campus: string;
  transit: string;
  venue: string;
}

export interface NewsletterIssue {
  volume: number;
  issue: number;
  slug: string;
  title: string;
  subtitle: string;
  publishDate: string;
  featureSpotlight: string;
  primaryInTheNews: string;
  verticalNews: VerticalNews;
  fundingFocus: string;
  pdfUrl?: string;
  status: IssueStatus;
  coverTagline?: string;
  isHolidayIssue?: boolean;
  featuredVerticals: Vertical[];
}

export const VERTICAL_LABELS: Record<Vertical, string> = {
  psap: "911 / PSAP",
  campus: "Campus Safety",
  transit: "Transit Safety",
  venue: "Venue Safety",
};

export const VERTICAL_COLORS: Record<Vertical, string> = {
  psap: "#1565C0",
  campus: "#00695C",
  transit: "#F59E0B",
  venue: "#7C3AED",
};

/**
 * Public archive catalog for the marketing site.
 * Sales Automation syncs **published** editions from
 * `packages/shared/src/rapid-iq/signal-editions.ts` — keep statuses aligned when publishing.
 */
export const NEWSLETTER_ISSUES: NewsletterIssue[] = [
  {
    volume: 1,
    issue: 1,
    slug: "vol1-no1-introduction",
    title: "Introduction to NexCortiQ",
    subtitle: "Redefining Emergency Communications Intelligence",
    publishDate: "2026-11-01",
    featureSpotlight: "Full Platform Overview — Every NexCortiQ Module Across All Verticals",
    primaryInTheNews: "88% of Emergency Call Centers Experienced a Technology Outage in 2026",
    verticalNews: {
      psap: "911 staffing crisis deepens — NENA reports record dispatcher vacancy rates heading into 2027",
      campus: "Campus safety directors cite communication gaps as top concern in 2026 ACUHO-I survey",
      transit: "Transit agencies report rising security incidents as federal monitoring expands to smaller systems",
      venue: "Venue safety incidents at major events spike in 2026 — industry calls for unified communications standards",
    },
    fundingFocus: "PSAP Modernization Grants & BRIC 2027 Cycle Opens",
    pdfUrl: "/newsletters/nexcortiq-signal-vol1-no1.pdf",
    status: "published",
    coverTagline: "Intelligence at the speed of response — introducing NexCortiQ.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 2,
    slug: "vol1-no2-holiday-2026",
    title: "911 During the Holidays",
    subtitle: "High-Volume Season. The Same Urgency.",
    publishDate: "2026-12-01",
    featureSpotlight: "Platform Resilience — NexCortiQ During Peak Demand Across All Verticals",
    primaryInTheNews: "Holiday Season 911 Surge: When Call Volume Spikes and Staffing Drops",
    verticalNews: {
      psap: "Holiday overtime at dispatch centers reaches five-year high — agencies struggle to cover the Christmas-New Year window",
      campus: "Winter break campus security incidents: how empty campuses create new threat profiles",
      transit: "Holiday travel surge strains transit security — incidents at major hubs up 18% from 2025",
      venue: "New Year's Eve mass gatherings: venue safety teams prepare for record attendance at stadium events",
    },
    fundingFocus: "Year-End Grant Deadlines — 2027 Budget Cycle Now Open for Planning",
    status: "upcoming",
    coverTagline: "More calls. Thinner staffing. This is where NexCortiQ earns its place.",
    isHolidayIssue: true,
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 3,
    slug: "vol1-no3-pre-arrival-iq",
    title: "Pre-Arrival iQ",
    subtitle: "What If Responders Knew Before They Arrived?",
    publishDate: "2027-01-01",
    featureSpotlight: "Pre-Arrival iQ — Secure SMS, Unit Tracking & Caller Instructions",
    primaryInTheNews:
      "Milwaukee August 2026 — Dispatchers Failed to Escalate. Officials Walked Out of Their Own Press Conference.",
    verticalNews: {
      psap: "Milwaukee August 2026 botched 911 response for 99-year-old assault victim — dispatchers failed to escalate",
      campus:
        "University EMS response time gaps — students calling 911 average 6+ minutes before on-campus unit arrival",
      transit:
        "Transit medical emergency response: passengers waiting an average 9 minutes after first 911 call at major metro hubs",
      venue:
        "Venue medical emergency at a sold-out NFL game highlights pre-arrival communication gap between 911 and in-venue EMS",
    },
    fundingFocus: "FirstNet Funding & SLIGP Grant Opportunities for 2027",
    status: "upcoming",
    coverTagline: "Closing the gap between dispatch and arrival.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 4,
    slug: "vol1-no4-ng911-radio-intelligence",
    title: "NG911 Radio Intelligence",
    subtitle: "Command Clarity in Real Time",
    publishDate: "2027-02-01",
    featureSpotlight:
      "NG911 Radio Intelligence — Real-Time Transcription, Unit Tracking & Supervisor Dashboard",
    primaryInTheNews:
      "NYC Motorola Software Crash — 24,000 Callers Per Day. No Backup Plan. City Still Investigating.",
    verticalNews: {
      psap: "NYC Motorola software update crashes 911 dispatch — a buggy update on a live system serving 24,000 callers per day",
      campus:
        "Campus radio interoperability failures during multi-agency active threat drills expose command communication gaps",
      transit:
        "Transit control center radio failures during January 2027 winter storm caused 40-minute dispatch blackout in Chicago",
      venue:
        "Major venue security director: 'Our radio channels are overcrowded at sellout events — we need AI to manage the traffic'",
    },
    fundingFocus: "NG911 Implementation Funds — FY2027 Applications Now Open",
    status: "upcoming",
    coverTagline: "Every transmission. Every unit. Every incident. In real time.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 5,
    slug: "vol1-no5-iq-vision",
    title: "iQ Vision — Scene Intelligence",
    subtitle: "See the Scene Before Units Arrive",
    publishDate: "2027-03-01",
    featureSpotlight:
      "iQ Vision — AI-Powered Camera Analysis, Threat Detection & Real-Time Scene Intelligence",
    primaryInTheNews:
      "Campus Camera Blind Spots in Active Threat Response — Dispatch Had No Visual Until Units Were on Scene",
    verticalNews: {
      psap: "PSAP directors report camera access as top unfulfilled NG911 capability — 76% still have no visual feeds at dispatch",
      campus:
        "Active threat response study: campuses with monitored camera access reduce response time by an average 2.4 minutes",
      transit:
        "Transit security incidents captured on CCTV but not monitored live — agencies under fire for reactive-only camera use",
      venue:
        "Super Bowl LXII security debrief cites AI-assisted crowd monitoring as key to early intervention at three incidents",
    },
    fundingFocus: "STOP School Violence Act Grants & Campus Safety Infrastructure Funds",
    status: "upcoming",
    coverTagline: "Visual intelligence, delivered to dispatch in real time.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 6,
    slug: "vol1-no6-ai-call-assist",
    title: "AI Call Assist — Nova Sonic",
    subtitle: "Every Call. Handled with Intelligence.",
    publishDate: "2027-04-01",
    featureSpotlight:
      "AI Call Assist / Nova Sonic — Real-Time Call Guidance, Transcription & Non-Emergency Routing",
    primaryInTheNews:
      "911 Call Handling Failures: Caller Abandonment Rates Hit Record High as Dispatch Wait Times Grow",
    verticalNews: {
      psap: "National 911 caller abandonment rate rises to 12% — dispatchers cite call volume as unsustainable without AI support",
      campus:
        "University campus 911 centers handling 60%+ non-emergency calls — AI routing could free dispatchers for real emergencies",
      transit:
        "Transit customer service lines overwhelmed with security-adjacent calls — agencies asking: should AI handle tier-one contacts?",
      venue:
        "Venue operations centers log thousands of non-emergency contacts per event — intelligent routing is an untapped efficiency",
    },
    fundingFocus: "Dispatcher Workforce Development & Technology Adoption Grants",
    status: "upcoming",
    coverTagline: "Augmenting every call — not replacing the dispatcher.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 7,
    slug: "vol1-no7-audio-intelligence",
    title: "Audio Intelligence",
    subtitle: "Hear What Your Dispatchers Can't",
    publishDate: "2027-05-01",
    featureSpotlight:
      "Audio Intelligence — Background Sound Analysis, Threat Classification & Caller Environment Detection",
    primaryInTheNews: "Radio-Silent Officer Safety Incidents: When No One Heard the Call for Help",
    verticalNews: {
      psap: "Three officer safety incidents in Q1 2027 traced to missed distress signals — audio AI would have flagged all three",
      campus:
        "Campus safety study: background audio on 911 calls contains actionable threat data in 34% of active incident calls",
      transit:
        "Transit incident: passenger emergency call dropped — background audio analysis later confirmed assault in progress",
      venue:
        "Venue AV systems inadvertently suppress emergency audio — new AI tools identify masked distress signals in crowd noise",
    },
    fundingFocus: "COPS Technology Program — Officer Safety Technology Grants",
    status: "upcoming",
    coverTagline: "The sounds behind the call — analyzed and surfaced automatically.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 8,
    slug: "vol1-no8-cad-integration",
    title: "CAD Integration Layer",
    subtitle: "One Platform. Every CAD System.",
    publishDate: "2027-06-01",
    featureSpotlight: "CAD Integration Layer — Real-Time Bidirectional Connectivity with Any CAD System",
    primaryInTheNews:
      "CAD Interoperability Failures During Mutual Aid Events — Units Dispatched to Wrong Locations",
    verticalNews: {
      psap: "Multi-agency CAD interoperability failure during regional wildfire mutual aid — units crossed jurisdictions without shared situational awareness",
      campus:
        "Campus public safety CAD systems often isolated from municipal 911 — the integration gap that costs response time",
      transit:
        "Transit operations centers running parallel incident logs to CAD — dual entry creates error risk and delays",
      venue: "Venue security operating on paper logs during large events — no CAD integration means no shared record",
    },
    fundingFocus: "SAFECOM Grants & SCIP Interoperability Funding",
    status: "upcoming",
    coverTagline: "NexCortiQ works with your CAD — not instead of it.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 9,
    slug: "vol1-no9-campus-safety",
    title: "Campus Safety Intelligence",
    subtitle: "Every Student. Every Building. Every Second.",
    publishDate: "2027-07-01",
    featureSpotlight:
      "NexCortiQ Campus Suite — Pre-Arrival iQ, iQ Vision & Audio Intelligence for Higher Education & K–12",
    primaryInTheNews:
      "Campus Safety Response Gaps — Clery Act Compliance Failures Expose Universities to Liability",
    verticalNews: {
      psap: "Municipal PSAPs report campus call surges straining dispatch — many universities still routing through general 911 with no campus-specific integration",
      campus:
        "Clery Act compliance failures cost universities $2.4 million in fines in 2026 — most tied to notification timing failures",
      transit:
        "Campus shuttle and transit security incidents on the rise — students reporting safety concerns on evening routes",
      venue:
        "On-campus stadium events: how NexCortiQ bridges campus safety and large-venue operations in one platform",
    },
    fundingFocus: "Clery Act Compliance Funding & RAVE Campus Safety Grants",
    status: "upcoming",
    coverTagline: "Protecting every campus — before the first unit arrives.",
    featuredVerticals: ["campus", "psap", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 10,
    slug: "vol1-no10-transit-safety",
    title: "Transit Safety Intelligence",
    subtitle: "Every Route. Every Station. Every Passenger.",
    publishDate: "2027-08-01",
    featureSpotlight:
      "NexCortiQ Transit Suite — iQ Vision, NG911 Radio Intelligence & CAD Integration for Transit Agencies",
    primaryInTheNews:
      "Transit Security Incidents Up 22% in 2027 — Agencies Under Pressure With No Real-Time Intelligence Layer",
    verticalNews: {
      psap: "Transit 911 calls overwhelming metro PSAPs — transit-generated calls now account for 11% of all urban 911 volume",
      campus:
        "Campus transit shuttles operating outside safety intelligence networks — a gap campus safety directors are addressing in 2027",
      transit:
        "FTA safety audit flags 14 major transit agencies for inadequate real-time security monitoring at unstaffed stations",
      venue:
        "Event night transit surge: how transit agencies are partnering with venue security teams to coordinate arrivals and departures",
    },
    fundingFocus: "FTA Safety & Security Grant Program — FY2027 Cycle",
    status: "upcoming",
    coverTagline: "Safety intelligence across every route, station, and vehicle.",
    featuredVerticals: ["transit", "psap", "campus", "venue"],
  },
  {
    volume: 1,
    issue: 11,
    slug: "vol1-no11-nexiq-signal",
    title: "NexiQ Signal Intelligence",
    subtitle: "The Procurement Layer No One Else Has",
    publishDate: "2027-09-01",
    featureSpotlight:
      "NexiQ — AI-Powered Procurement Signal Monitoring Across PSAP, Campus, Transit & Venue",
    primaryInTheNews:
      "Public Safety Agencies Missing Modernization Windows — The Procurement Gap No One Talks About",
    verticalNews: {
      psap: "PSAP modernization RFPs hit a 10-year high in 2027 — agencies that miss the cycle wait 3–5 years for the next window",
      campus:
        "Campus safety technology spending up 34% in FY2027 — but most RFPs go uncontested due to limited vendor awareness",
      transit:
        "FTA competitive grants for security technology go unawarded at record rates — eligible agencies not applying",
      venue:
        "Venue safety technology procurement is evolving: how stadium operators are moving to multi-year platform contracts",
    },
    fundingFocus: "Technology Modernization Funds & Competitive Grant Opportunities",
    status: "upcoming",
    coverTagline: "We track the signals so your agency never misses an opportunity.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
  {
    volume: 1,
    issue: 12,
    slug: "vol1-no12-year-in-review",
    title: "Year One in Review",
    subtitle: "What We Built. What Changed. What's Next.",
    publishDate: "2027-10-01",
    featureSpotlight: "Full Platform Review — NexCortiQ Year One Across All Verticals",
    primaryInTheNews: "The State of Public Safety Technology in 2027 — A Year of Urgency and Progress",
    verticalNews: {
      psap: "2027 PSAP technology report: AI adoption accelerates, staffing crisis persists, NG911 migration behind schedule in 60% of states",
      campus:
        "Campus safety technology investment reaches historic levels — but implementation gaps remain at smaller institutions",
      transit:
        "Transit security technology modernization accelerates under FTA pressure — real-time monitoring now standard at Tier 1 agencies",
      venue:
        "Venue safety technology: the year AI-assisted monitoring became the expectation, not the exception",
    },
    fundingFocus: "2028 Budget Cycle Preview — Grant Opportunities Opening Q1",
    status: "upcoming",
    coverTagline: "One year. Four verticals. One platform. What comes next is bigger.",
    featuredVerticals: ["psap", "campus", "transit", "venue"],
  },
];

export function getCurrentIssue(): NewsletterIssue | undefined {
  return [...NEWSLETTER_ISSUES]
    .filter((i) => i.status === "published")
    .sort((a, b) => b.volume - a.volume || b.issue - a.issue)[0];
}

export function getNextIssue(): NewsletterIssue | undefined {
  return NEWSLETTER_ISSUES.find((i) => i.status === "upcoming");
}

export function getPublishedIssues(): NewsletterIssue[] {
  return NEWSLETTER_ISSUES.filter((i) => i.status === "published").sort(
    (a, b) => b.volume - a.volume || b.issue - a.issue || b.publishDate.localeCompare(a.publishDate),
  );
}

export function getUpcomingIssues(): NewsletterIssue[] {
  return NEWSLETTER_ISSUES.filter((i) => i.status === "upcoming").sort(
    (a, b) => a.volume - b.volume || a.issue - b.issue,
  );
}

export function getIssueBySlug(slug: string): NewsletterIssue | undefined {
  return NEWSLETTER_ISSUES.find((i) => i.slug === slug);
}

export function getAllIssueSlugs(): string[] {
  return NEWSLETTER_ISSUES.map((i) => i.slug);
}

export function issueLabel(i: NewsletterIssue): string {
  return `Vol. ${i.volume}, No. ${i.issue}: ${i.title}`;
}

export function formatIssueMonth(iso: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** When a vertical filter is active, issues featuring that vertical first sort to the top. */
export function sortIssuesForVertical(
  issues: NewsletterIssue[],
  vertical: Vertical | "all",
): NewsletterIssue[] {
  if (vertical === "all") return issues;
  return [...issues].sort((a, b) => {
    const aPrimary = a.featuredVerticals[0] === vertical ? 0 : 1;
    const bPrimary = b.featuredVerticals[0] === vertical ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return b.issue - a.issue;
  });
}

export function getIssuesByVertical(vertical: Vertical): NewsletterIssue[] {
  return NEWSLETTER_ISSUES.filter((i) => i.featuredVerticals.includes(vertical));
}
