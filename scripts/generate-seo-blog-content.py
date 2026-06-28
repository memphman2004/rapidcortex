#!/usr/bin/env python3
"""Generate apps/marketing/lib/blog/seo-post-content.ts from SEO calendar entries."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "apps/marketing/lib/blog/seo-post-content.ts"

ENTRIES: list[dict[str, str]] = [
    {"slug": "modernize-emergency-communications-without-replacing-cad", "title": "How to Modernize Emergency Communications Without Replacing CAD", "hub": "Leadership & Buying", "seoFocus": "CAD modernization"},
    {"slug": "campus-safety-no-app-reporting", "title": "Why Campus Safety Reporting Should Not Require Downloading Another App", "hub": "Campus Safety", "seoFocus": "campus safety reporting"},
    {"slug": "stadium-safety-text-reporting", "title": "Why Stadium Safety Reporting Should Be as Easy as Sending a Text", "hub": "Venue Safety", "seoFocus": "stadium safety texting"},
    {"slug": "911-real-time-call-transcription", "title": "Why 911 Call Takers Need Real-Time Transcription During High-Stress Calls", "hub": "911, PSAP & NG911", "seoFocus": "911 call transcription"},
    {"slug": "airport-safety-reporting-platform", "title": "Why Airports Need Faster Ways for Travelers to Report Safety Concerns", "hub": "Airport Safety", "seoFocus": "airport safety reporting"},
    {"slug": "what-is-incident-intelligence-platform", "title": "What Is an Incident Intelligence Platform for Public Safety?", "hub": "Buyer Intent", "seoFocus": "incident intelligence platform"},
    {"slug": "silent-911-text-chat", "title": "What Happens When a 911 Caller Cannot Safely Speak?", "hub": "911, PSAP & NG911", "seoFocus": "silent 911 communication"},
    {"slug": "beyond-blue-light-campus-safety", "title": "Campus Safety Beyond Blue Light Phones: What Universities Need Next", "hub": "Campus Safety", "seoFocus": "blue light phone alternatives"},
    {"slug": "fan-to-security-communication", "title": "What Happens When a Fan Needs Security but Does Not Know Who to Call?", "hub": "Venue Safety", "seoFocus": "fan security communication"},
    {"slug": "cjis-aligned-public-safety-software", "title": 'What "CJIS-Aligned" Should Mean When Evaluating Public Safety Software', "hub": "Leadership & Buying", "seoFocus": "CJIS aligned software"},
    {"slug": "live-translation-911-centers", "title": "The Role of Live Translation in Modern Emergency Communications Centers", "hub": "911, PSAP & NG911", "seoFocus": "911 translation services"},
    {"slug": "campus-safety-qr-code-reporting", "title": "How QR Codes Can Create Faster Safety Reporting Across Campus", "hub": "Campus Safety", "seoFocus": "campus safety QR code"},
    {"slug": "arena-safety-without-more-staff", "title": "How Arenas Can Improve Fan Safety Without Hiring More Security Staff", "hub": "Venue Safety", "seoFocus": "arena security technology"},
    {"slug": "airport-passenger-incident-reporting", "title": "How Airport Operations Teams Can Receive Passenger Reports in Real Time", "hub": "Airport Safety", "seoFocus": "airport incident reporting"},
    {"slug": "receive-caller-photos-videos-emergency", "title": "What Is the Best Way to Receive Photos and Videos From Emergency Callers?", "hub": "Buyer Intent", "seoFocus": "emergency caller media intake"},
    {"slug": "clery-act-incident-reporting-workflows", "title": "Improving Clery Act Documentation With Better Incident Reporting Workflows", "hub": "Campus Safety", "seoFocus": "Clery Act reporting software"},
    {"slug": "venue-safety-qr-nfc-text", "title": "QR Codes, NFC Tags, and Text Messages: The Future of Venue Safety Reporting", "hub": "Venue Safety", "seoFocus": "venue safety QR code"},
    {"slug": "public-safety-technology-pilot-program", "title": "How Agencies Can Pilot New Technology Without Disrupting Daily Operations", "hub": "Leadership & Buying", "seoFocus": "public safety pilot program"},
    {"slug": "real-time-call-summaries-dispatchers", "title": "How Real-Time Call Summaries Can Reduce Dispatcher Workload", "hub": "911, PSAP & NG911", "seoFocus": "dispatcher workload reduction"},
    {"slug": "residence-hall-emergency-reporting", "title": "Why Residence Halls Need Better Emergency Communication Options", "hub": "Campus Safety", "seoFocus": "dorm safety technology"},
    {"slug": "stadium-security-photo-location-reporting", "title": "How Stadium Security Teams Can Receive Incident Photos and Location Details Faster", "hub": "Venue Safety", "seoFocus": "stadium incident reporting"},
    {"slug": "airport-terminal-security-communication", "title": "Improving Security Communication Across Airport Terminals", "hub": "Airport Safety", "seoFocus": "airport security communications"},
    {"slug": "psap-supervisor-visibility", "title": "How PSAP Supervisors Can Improve Visibility Without Adding More Screens", "hub": "911, PSAP & NG911", "seoFocus": "PSAP supervisor dashboard"},
    {"slug": "rapid-cortex-vs-traditional-cad", "title": "Rapid Cortex vs. Traditional CAD: What Is the Difference?", "hub": "Buyer Intent", "seoFocus": "Rapid Cortex vs CAD"},
    {"slug": "silent-campus-emergency-reporting", "title": "How Universities Can Improve Student Safety Communication During Silent Emergencies", "hub": "Campus Safety", "seoFocus": "campus emergency reporting"},
    {"slug": "venue-safety-beyond-cameras", "title": "Why Venue Safety Is More Than Cameras and Metal Detectors", "hub": "Venue Safety", "seoFocus": "venue security technology"},
    {"slug": "public-safety-intelligence-platform-guide", "title": "A Public Safety Leader's Guide to Evaluating Real-Time Intelligence Platforms", "hub": "Leadership & Buying", "seoFocus": "public safety intelligence platform"},
    {"slug": "psap-caller-photo-video-intake", "title": "Why Every PSAP Should Have a Secure Way to Receive Caller Photos and Videos", "hub": "911, PSAP & NG911", "seoFocus": "911 photo video intake"},
    {"slug": "campus-police-media-intake", "title": "How Campus Police Can Receive Photos, Videos, and Location Information Faster", "hub": "Campus Safety", "seoFocus": "campus police technology"},
    {"slug": "event-security-response-time", "title": "How Event Security Teams Can Reduce the Time Between Report and Response", "hub": "Venue Safety", "seoFocus": "event security response time"},
    {"slug": "airport-qr-code-safety-reporting", "title": "QR Code Safety Reporting for Airports: Benefits, Risks, and Best Practices", "hub": "Airport Safety", "seoFocus": "airport QR safety"},
    {"slug": "campus-safety-reporting-software-cost", "title": "How Much Does Campus Safety Reporting Software Cost?", "hub": "Buyer Intent", "seoFocus": "campus safety reporting software cost"},
    {"slug": "cad-vs-incident-awareness-platform", "title": "Why CAD Alone Is Not Enough for Modern Incident Awareness", "hub": "911, PSAP & NG911", "seoFocus": "CAD integration public safety"},
    {"slug": "university-safety-communication-layer", "title": "What a Modern University Safety Communication Layer Looks Like", "hub": "Campus Safety", "seoFocus": "university safety communications"},
    {"slug": "fan-safety-signage-stadiums", "title": "What Every Sports Venue Should Include in Its Fan Safety Signage", "hub": "Venue Safety", "seoFocus": "stadium safety signage"},
    {"slug": "public-safety-interoperability", "title": "Why Interoperability Matters More Than Another Standalone Public Safety Tool", "hub": "Leadership & Buying", "seoFocus": "public safety interoperability"},
    {"slug": "multimedia-911-call-preparedness", "title": "How 911 Centers Can Prepare for Multimedia Emergency Calls", "hub": "911, PSAP & NG911", "seoFocus": "multimedia 911"},
    {"slug": "campus-event-safety-technology", "title": "How Universities Can Improve Safety During Large Campus Events", "hub": "Campus Safety", "seoFocus": "university event safety"},
    {"slug": "live-event-security-situational-awareness", "title": "How Live Event Security Teams Can Improve Situational Awareness", "hub": "Venue Safety", "seoFocus": "event security situational awareness"},
    {"slug": "airport-incident-visibility", "title": "How Airports Can Improve Incident Visibility Without Replacing Existing Systems", "hub": "Airport Safety", "seoFocus": "airport security technology"},
    {"slug": "stadium-incident-reporting-software-cost", "title": "How Much Does Stadium Incident Reporting Technology Cost?", "hub": "Buyer Intent", "seoFocus": "stadium incident reporting cost"},
    {"slug": "ng911-for-small-psaps", "title": "What NG911 Means for Smaller 911 Centers", "hub": "911, PSAP & NG911", "seoFocus": "NG911 small PSAP"},
    {"slug": "silent-emergency-reporting-colleges", "title": "How Colleges Can Support Students Who Cannot Safely Make a Phone Call", "hub": "Campus Safety", "seoFocus": "silent emergency reporting"},
    {"slug": "venue-security-incident-routing", "title": "How Venue Security Can Route Fan Reports to the Right Team Faster", "hub": "Venue Safety", "seoFocus": "venue security dispatch"},
    {"slug": "fragmented-emergency-communication-tools", "title": "The Hidden Cost of Fragmented Emergency Communication Tools", "hub": "Leadership & Buying", "seoFocus": "emergency communications software"},
    {"slug": "911-shift-handoff-continuity-log", "title": "Why Incident Notes Get Lost Between Shifts — and How Continuity Logs Help", "hub": "911, PSAP & NG911", "seoFocus": "911 shift handoff"},
    {"slug": "campus-safety-incident-visibility", "title": "How Campus Safety Teams Can Improve Incident Visibility Across Departments", "hub": "Campus Safety", "seoFocus": "campus incident management"},
    {"slug": "nfc-venue-safety-signage", "title": "How NFC Safety Signs Can Improve Reporting Inside Large Venues", "hub": "Venue Safety", "seoFocus": "NFC venue safety"},
    {"slug": "airport-safety-reporting-gate-parking", "title": "From Gate to Parking Deck: Modernizing Airport Safety Reporting", "hub": "Airport Safety", "seoFocus": "airport safety reporting system"},
    {"slug": "campus-safety-reporting-platform-buyers-guide", "title": "What Should a University Look for in a Campus Safety Reporting Platform?", "hub": "Buyer Intent", "seoFocus": "campus safety reporting platform"},
    {"slug": "dispatcher-supervisor-shadow-mode", "title": "How Supervisor Shadow Mode Can Support New Dispatchers", "hub": "911, PSAP & NG911", "seoFocus": "dispatcher training technology"},
    {"slug": "anonymous-reporting-campus-safety", "title": "Why Anonymous Reporting Alone Is Not Enough for Campus Safety", "hub": "Campus Safety", "seoFocus": "anonymous campus reporting"},
    {"slug": "venue-parking-lot-safety-reporting", "title": "Improving Safety Communication in Parking Lots, Entrances, and Concourse Areas", "hub": "Venue Safety", "seoFocus": "parking lot incident reporting"},
    {"slug": "incident-intelligence-software-features", "title": "10 Features Public Safety Agencies Should Look for in Incident Intelligence Software", "hub": "Leadership & Buying", "seoFocus": "incident intelligence software"},
    {"slug": "911-documentation-automation", "title": "How Emergency Communications Centers Can Improve Documentation Without More Manual Typing", "hub": "911, PSAP & NG911", "seoFocus": "911 incident documentation"},
    {"slug": "college-parent-campus-safety-expectations", "title": "The Parent Perspective: What Families Expect From Campus Safety Programs", "hub": "Campus Safety", "seoFocus": "college campus safety"},
    {"slug": "venue-911-escalation-workflow", "title": "Why Every Venue Needs a Clear 911 Escalation Workflow", "hub": "Venue Safety", "seoFocus": "venue 911 escalation"},
    {"slug": "fan-safety-platform-buyers-guide", "title": "What Should a Stadium Look for in a Fan Safety Communication Platform?", "hub": "Buyer Intent", "seoFocus": "fan safety platform"},
    {"slug": "language-access-public-safety", "title": "Why Language Access Is Now a Public Safety Priority", "hub": "911, PSAP & NG911", "seoFocus": "public safety language access"},
    {"slug": "campus-safety-system-integration", "title": "Why Campus Safety Technology Must Work Alongside Existing Systems", "hub": "Campus Safety", "seoFocus": "campus safety integrations"},
    {"slug": "airport-arena-stadium-reporting", "title": "Why Airports, Arenas, and Stadiums Need a Better Incident Reporting Layer", "hub": "Venue Safety", "seoFocus": "venue incident reporting platform"},
    {"slug": "real-time-operational-awareness-public-safety", "title": "Why Real-Time Operational Awareness Is Becoming a Public Safety Standard", "hub": "Leadership & Buying", "seoFocus": "operational awareness platform"},
    {"slug": "911-technology-buying-guide", "title": "7 Questions Every 911 Director Should Ask Before Buying New Technology", "hub": "911, PSAP & NG911", "seoFocus": "911 technology purchasing"},
    {"slug": "public-safety-software-deployment-time", "title": "How Long Does It Take to Deploy Public Safety Communication Software?", "hub": "Buyer Intent", "seoFocus": "public safety software deployment"},
    {"slug": "modern-campus-safety-technology", "title": "What Students Expect From Modern Campus Safety Technology", "hub": "Campus Safety", "seoFocus": "campus safety technology"},
    {"slug": "public-safety-cad-telephony-integration", "title": "Can Public Safety Technology Integrate With Existing CAD and Telephony Systems?", "hub": "Buyer Intent", "seoFocus": "CAD telephony integration"},
    {"slug": "voice-to-video-emergency-communications", "title": "From Voice Call to Video: The Future of Emergency Communications", "hub": "911, PSAP & NG911", "seoFocus": "emergency video intake"},
]

COMPLIANCE_CALLOUT_SLUGS = {
    "cjis-aligned-public-safety-software": {
        "tone": "caution",
        "label": "Compliance note",
        "text": (
            "No software vendor can claim CJIS certification on your behalf. "
            "CJIS-aligned design means audit logging, access controls, and data handling "
            "practices that support your agency's CJIS Security Policy obligations — "
            "your agency remains responsible for policy compliance and vendor agreements."
        ),
    },
    "clery-act-incident-reporting-workflows": {
        "tone": "note",
        "label": "Clery Act responsibility",
        "text": (
            "Better reporting workflows can strengthen Clery Act recordkeeping and timely "
            "warning documentation, but they do not replace your institution's compliance "
            "program. Clery compliance remains the institution's responsibility with "
            "legal and campus counsel."
        ),
    },
    "anonymous-reporting-campus-safety": {
        "tone": "caution",
        "label": "Anonymous reporting limits",
        "text": (
            "Anonymous channels can encourage reporting, but they often lack location, "
            "follow-up context, and real-time routing. Pair anonymous options with "
            "identified, low-friction channels so campus police can respond when seconds matter."
        ),
    },
}

HUB_INTRO_LINKS: dict[str, list[str]] = {
    "Leadership & Buying": [
        "[Rapid Cortex Core](/product/core)",
        "[CAD integration](/cad-integration)",
        "[Rapid Cortex Offerings](/blog/rapid-cortex-offerings)",
    ],
    "Campus Safety": [
        "[Rapid Cortex Campus](/product/campus)",
        "[campus safety overview](/blog/rapid-cortex-campus)",
        "[pricing](/pricing)",
    ],
    "Venue Safety": [
        "[Rapid Cortex Venue](/venue)",
        "[venue safety overview](/blog/rapid-cortex-venue)",
        "[schedule a demo](/demo)",
    ],
    "Airport Safety": [
        "[Rapid Cortex Venue](/venue)",
        "[airport and venue reporting](/blog/rapid-cortex-venue)",
        "[contact sales](/contact-sales)",
    ],
    "911, PSAP & NG911": [
        "[Rapid Cortex Core](/product/core)",
        "[911 call transcription](/911-call-transcription)",
        "[NG911 software](/ng911-software)",
    ],
    "Buyer Intent": [
        "[incident intelligence platform overview](/blog/what-is-incident-intelligence-platform)",
        "[Rapid Cortex Core](/product/core)",
        "[contact sales](/contact-sales)",
    ],
}

HUB_CONTEXT: dict[str, str] = {
    "Leadership & Buying": "public safety directors and agency executives",
    "Campus Safety": "campus safety and university police teams",
    "Venue Safety": "venue security and event operations leaders",
    "Airport Safety": "airport operations and terminal security teams",
    "911, PSAP & NG911": "911 directors, PSAP supervisors, and call takers",
    "Buyer Intent": "procurement teams and technology evaluators",
}


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def cad_disclaimer(hub: str) -> str:
    if hub in ("911, PSAP & NG911", "Leadership & Buying", "Buyer Intent"):
        return (
            " Rapid Cortex enhances operations alongside CAD, telephony, dispatchers, "
            "and medical direction — it does not replace them."
        )
    if hub in ("Campus Safety",):
        return (
            " Campus tools should augment — not replace — existing police dispatch, "
            "mass notification, and emergency protocols."
        )
    return (
        " Venue intelligence layers work with radios, cameras, and on-site staff — "
        "they do not replace 911, CAD, or trained security personnel."
    )


def expand_paragraph(core: str, entry: dict[str, str], extra: str = "") -> str:
    text = core.strip()
    if extra.strip():
        text = f"{text} {extra.strip()}"
    return text


HUB_SECTION_ADDENDA: dict[str, list[list[str]]] = {
    "911, PSAP & NG911": [
        [
            "Most gaps show up before CAD entry: callers cannot articulate location, supervisors cannot see the call thread, and shift change loses context.",
            "Document where telephony recordings, CAD notes, and multimedia intake diverge today — that map defines the pilot scope.",
            "When evaluators search for operational fixes, they usually discover the bottleneck is information structure — not dispatcher skill.",
            "Run a tabletop with call takers, supervisors, and IT to list every place {focus} data gets retyped today.",
        ],
        [
            "Call takers need one calm timeline for voice, text, translation, and media — not four tabs that fight for attention.",
            "Medical direction and dispatch authority stay with trained personnel; software should surface context, not auto-dispatch.",
            "High-stress calls prove whether {focus} actually reduces repeated questions or just adds another pane of glass.",
        ],
        [
            "Supervisors should monitor live queues and review transcripts without standing behind a console.",
            "Shift handoff logs must carry incident notes forward so the next team does not re-ask the same questions.",
            "QA teams benefit when transcripts and summaries are searchable for coaching — without replacing official CAD narratives.",
        ],
        [
            "Integrate with [CAD integration](/cad-integration) patterns rather than rip-and-replace projects.",
            "Rapid Cortex Core enhances operations alongside CAD, telephony, dispatchers, and medical direction — it does not replace them.",
            "Start with one shift or one supervisor desk, measure time-to-context for {focus}, then expand with union and IT buy-in.",
        ],
    ],
    "Campus Safety": [
        [
            "Students report through whatever is fastest — often SMS or a QR scan — not another app icon on a crowded home screen.",
            "Residence halls, athletic venues, and parking structures each need building-aware routing without a separate product per zone.",
            "Parent and student expectations for {focus} rise every year — legacy blue-light-only models feel dated on move-in weekend.",
        ],
        [
            "Silent emergencies require text-first paths that still give campus police enough location context to respond.",
            "[Rapid Cortex Campus](/product/campus) maps intake to buildings and routes to the right campus team.",
            "Training resident advisors and front-desk staff on QR signage turns passive posters into active reporting channels.",
        ],
        [
            "Clery workflows benefit from timestamped intake, but compliance classification remains with your Clery coordinator and counsel.",
            "Share read-only views with student affairs and facilities only when role policy allows.",
            "Cross-department visibility for {focus} prevents the same incident from being re-entered in three different systems.",
        ],
        [
            "Roll out QR and NFC signage where students already walk — dining halls, bus stops, recreation centers — and measure uptake weekly.",
            "Campus tools augment existing police dispatch, mass notification, and emergency protocols — they do not replace them.",
            "Pilot one residence hall or one large event before campus-wide activation so routing rules are tested under real load.",
        ],
    ],
    "Venue Safety": [
        [
            "Fans decide in seconds whether reporting is worth the friction; texting a short code beats downloading an event app.",
            "Concourse density means line-of-sight security fails exactly when you need structured reports from the crowd.",
            "Event nights compress hundreds of minor issues into minutes — {focus} must scale without hiring proportional staff.",
        ],
        [
            "Zone-based routing sends a parking-lot report to the right team without every alert hitting the command post.",
            "[Rapid Cortex Venue](/venue) ties intake to floor plans and escalation playbooks.",
            "Signage at section, row, and gate level gives fans language they understand when they need help fast.",
        ],
        [
            "Photo and video intake helps roaming teams confirm what radios alone cannot describe during a live event.",
            "Audit who viewed caller media and when — venue incidents attract liability and post-event review.",
            "Security command should see {focus} on one timeline instead of chasing screenshots across group texts.",
        ],
        [
            "Document when venue security escalates to 911 versus handles an issue on-site — staff should not guess under noise and crowd pressure.",
            "Venue intelligence layers work with radios, cameras, and on-site staff — they do not replace 911, CAD, or trained security personnel.",
            "Rehearse escalation paths during load-in so {focus} is muscle memory before doors open.",
        ],
    ],
    "Airport Safety": [
        [
            "Passengers move gate to gate faster than security can observe; reporting must work without knowing an airport acronym.",
            "Terminals mix TSA, airline, and airport police jurisdictions — intake should tag which zone generated the report.",
            "Irregular operations and weather delays concentrate crowds where {focus} gaps become visible quickly.",
        ],
        [
            "QR signage at gates, baggage claim, and parking decks gives travelers a consistent path to report concerns.",
            "[Rapid Cortex Venue](/venue) supports airport layouts with the same zone routing used in stadiums and arenas.",
            "Wayfinding for {focus} should mirror how passengers already navigate — not require staff acronyms or desk extensions.",
        ],
        [
            "Real-time passenger reports help operations teams spot smoke, disturbances, or medical issues before they cascade across a concourse.",
            "Multimedia intake must be encrypted in transit and access-controlled for investigators.",
            "Airport security communications improve when every terminal team shares the same structured view of open incidents.",
        ],
        [
            "Airport operations should rehearse 911 escalation when an incident exceeds on-site capacity — especially during irregular operations.",
            "Reporting layers integrate with existing airport security systems; they do not replace them.",
            "Measure {focus} from gate to parking deck so blind spots in remote lots get the same attention as ticket counters.",
        ],
    ],
    "Leadership & Buying": [
        [
            "Directors inherit CAD and telephony investments measured in decades — modernization should mean an intelligence layer, not a rip-and-replace mandate.",
            "Board conversations go better when you quantify time-to-context, not feature checklists.",
            "Stakeholders ask about {focus} after a near-miss — having a pilot plan ready beats scrambling for a vendor demo.",
        ],
        [
            "CJIS-aware design means encryption, access control, and audit logging — not vendor claims of certification on your behalf.",
            "Ask for sample audit exports and role matrices during procurement.",
            "Legal and IT should review {focus} together so security policy and operational needs align before go-live.",
        ],
        [
            "Parallel pilots on one desk or one shift prove value without betting the entire center on day one.",
            "[Free 60-day pilots](/free-60-day-pilot) let you validate workflows beside live CAD and telephony.",
            "Define rollback criteria up front so {focus} pilots fail safely if integrations are not ready.",
        ],
        [
            "Measure ROI in reduced rework: fewer repeated caller questions, cleaner shift logs, faster supervisor review.",
            "Rapid Cortex enhances operations alongside CAD, telephony, dispatchers, and medical direction — it does not replace them.",
            "Executives should revisit {focus} metrics quarterly — adoption curves flatten if supervisors do not model the workflow.",
        ],
    ],
    "Buyer Intent": [
        [
            "Evaluators should define the incident types they miss today — silent callers, campus reports, venue photos — before comparing vendors.",
            "A useful RFP lists integration points with CAD, telephony, SSO, and audit — not just feature counts.",
            "Search traffic for {focus} spikes when agencies realize CAD alone will not close their awareness gap.",
        ],
        [
            "Require live scenarios in demos: multimedia intake, translation, QR reporting, and supervisor visibility.",
            "[Contact sales](/contact-sales) for scoped walkthroughs across Core, Campus, and Venue.",
            "Score vendors on how {focus} behaves under load — not on slide decks with static screenshots.",
        ],
        [
            "Pricing models differ by vertical; compare pilot cost, activation per zone, and support tiers in writing.",
            "See [pricing](/pricing) for starting points and schedule a scoped quote for your environment.",
            "Hidden costs in {focus} projects often come from signage, training, and integration hours — budget them explicitly.",
        ],
        [
            "Deployment timelines hinge on integrations and signage — not slide-deck promises.",
            "Integration beats replacement: confirm [CAD integration](/cad-integration) paths before you sign.",
            "Ask for reference deployments where {focus} ran parallel to production for at least one major event or shift cycle.",
        ],
    ],
}


def section_depth_paragraph(entry: dict[str, str], section_idx: int) -> str:
    focus = entry["seoFocus"]
    hub = entry["hub"]
    templates = [
        (
            f"Before buying, document baseline metrics for {focus}: time to confirm location, "
            f"number of systems a supervisor checks during a single incident, and how often notes "
            f"are retyped between telephony, CAD, and radio. Those numbers become your pilot scorecard."
        ),
        (
            f"Workflow design for {focus} should be written with the people who work high-volume shifts — "
            f"not only IT or vendor solutions engineers. Short feedback loops during pilot week two "
            f"prevent expensive rework after go-live."
        ),
        (
            f"Governance for {focus} includes retention, export, and role reviews — especially where "
            f"CJIS-aware agencies share data with prosecutors or campus partners. "
            f"Legal, IT, and operations should sign the same data-flow diagram."
        ),
        (
            f"Scale {focus} only after the pilot proves stable integrations and training completion rates. "
            f"Communicate wins internally with real incident examples (sanitized) so frontline staff "
            f"see the tool as help — not surveillance or CAD replacement."
        ),
    ]
    text = templates[section_idx] if section_idx < len(templates) else templates[-1]
    if hub == "Campus Safety":
        text += " Clery documentation may benefit from structured intake, but compliance remains the institution's responsibility."
    elif hub in ("Venue Safety", "Airport Safety"):
        text += " Venue and airport teams should rehearse game-day or irregular-ops load before declaring the workflow production-ready."
    text += (
        f" Publish a one-page {focus} requirements memo before vendor demos so every stakeholder "
        f"scores the same workflows and integration assumptions."
    )
    return text


def format_addenda(entry: dict[str, str], lines: list[str]) -> list[str]:
    focus = entry["seoFocus"]
    return [line.format(focus=focus) for line in lines]


def section_headings(entry: dict[str, str]) -> list[str]:
    focus = entry["seoFocus"]
    title = entry["title"]
    hub = entry["hub"]
    slug = entry["slug"]

    if "cost" in slug or "buyers-guide" in slug or "buying-guide" in slug or "features" in slug:
        return [
            f"Why {focus} decisions stall without clear requirements",
            f"Evaluating {focus} against real workflows",
            f"What to ask vendors before you sign",
            f"Deployment, pilots, and total cost of ownership",
        ]

    if hub == "911, PSAP & NG911":
        return [
            f"The operational gap behind {focus}",
            f"How {focus} changes the call-taker workflow",
            f"Supervisor visibility and shift continuity",
            f"Integrating {focus} with CAD and telephony you already run",
        ]
    if hub == "Campus Safety":
        return [
            f"Where {focus} breaks down on a real campus",
            f"Student reporting friction and silent emergencies",
            f"Cross-department visibility for {focus}",
            f"Rolling out {focus} without another app download",
        ]
    if hub in ("Venue Safety", "Airport Safety"):
        venue_label = "airport" if hub == "Airport Safety" else "venue"
        return [
            f"Fan and passenger expectations for {focus}",
            f"Zone-based routing inside a complex {venue_label}",
            f"Multimedia intake during live events",
            f"911 escalation without replacing on-site security",
        ]
    if hub == "Leadership & Buying":
        return [
            f"The board-level case for {focus}",
            f"Risk, audit, and CJIS-aware design",
            f"Pilot programs that do not disrupt daily ops",
            f"Measuring ROI on {focus}",
        ]
    return [
        f"Defining {focus} for evaluators",
        f"How {focus} differs from CAD alone",
        title.split(":")[0] if ":" in title else f"Practical requirements for {focus}",
        f"Next steps for {focus} pilots",
    ]


def section_paragraphs(entry: dict[str, str], heading: str, section_idx: int) -> list[str]:
    hub = entry["hub"]
    focus = entry["seoFocus"]
    title = entry["title"]
    slug = entry["slug"]

    p1_cores = {
        0: (
            f"{title} starts with an honest workflow audit. Teams map where information arrives, "
            f"who sees it first, and how long it takes to reach someone who can act. "
            f"In most environments, {focus} fails at handoffs — not because staff are unprepared, "
            f"but because tools were built for single-channel incidents. "
            f"Leaders who treat {focus} as a overlay — not a CAD replacement — move faster through procurement "
            f"and union review because the operational model stays familiar."
        ),
        1: (
            f"During peak load, {focus} must reduce repetitive questions without removing human judgment. "
            f"Structured intake — text, photos, location pins, or QR scans — gives operators context "
            f"before they open a radio channel or CAD screen. That context should flow into notes "
            f"supervisors can review without standing over a shoulder. "
            f"The goal is fewer back-and-forth exchanges with callers and field units, not fewer humans in the loop."
        ),
        2: (
            f"Security and compliance reviews often ask whether new software creates another silo. "
            f"The right answer for {focus} is interoperability: APIs and exports that respect "
            f"existing records of truth, role-based access so each role sees only what it needs, "
            f"and append-only audit trails for sensitive actions. "
            f"CJIS-aware design language belongs in the evaluation — never confuse alignment with vendor-side certification."
        ),
        3: (
            f"Deployment should start with a bounded pilot — one terminal, one residence hall, "
            f"or one supervisor desk — with success criteria tied to time-to-context, not vanity metrics. "
            f"[Free 60-day pilots](/free-60-day-pilot) let {HUB_CONTEXT[hub]} validate {focus} "
            f"alongside live operations before a broader rollout. "
            f"Publish pilot results internally so stakeholders see evidence before scaling spend."
        ),
    }

    extras = {
        "911-real-time-call-transcription": [
            " Real-time transcription helps call takers capture names, addresses, and hazards while still listening.",
            " Summaries should feed supervisor dashboards and shift logs, not auto-dispatch units.",
            " See [911 call transcription](/911-call-transcription) for how Core supports live calls.",
            " Pair pilots with QA review so transcripts augment — not replace — call-taker notes.",
        ],
        "silent-911-text-chat": [
            " Text and chat paths matter when callers hide from a threat or cannot speak safely.",
            " Silent channels still need location validation and callback options.",
            " Core routes text alongside voice without replacing telephony.",
            " Train call takers on when to keep the caller in text versus voice.",
        ],
        "cjis-aligned-public-safety-software": [
            " Vendors should document encryption, access control, and logging — not claim certification for you.",
            " CJIS-aligned design supports policy; your CJIS Systems Officer still owns compliance.",
            " Ask for audit samples and role matrices during procurement.",
            " Rapid Cortex uses CJIS-aware design principles across deployments.",
        ],
        "clery-act-incident-reporting-workflows": [
            " Timestamped intake helps Clery recordkeeping and timely warning decisions.",
            " Workflows should route Clery-eligible incidents to compliance staff with audit trails.",
            " Software supports documentation; your Clery coordinator owns classification.",
            " Integrate with mass notification only after legal review.",
        ],
        "anonymous-reporting-campus-safety": [
            " Anonymous tips help culture but often lack location and callback paths.",
            " Pair anonymous web forms with QR and SMS reporting tied to buildings.",
            " Campus police still need identified channels for active threats.",
            " Document how anonymous reports are triaged and escalated.",
        ],
        "rapid-cortex-vs-traditional-cad": [
            " CAD remains the dispatch system of record for unit assignment.",
            " Rapid Cortex captures multimedia and structured intake CAD was not built to originate.",
            " Compare [Rapid Cortex Core](/product/core) alongside your CAD vendor roadmap.",
            " Integration beats replacement for most agencies.",
        ],
        "cad-vs-incident-awareness-platform": [
            " CAD excels at unit status and dispatch; it is weaker at pre-CAD caller media.",
            " Incident awareness layers sit upstream of CAD entry.",
            " Read [CAD integration](/cad-integration) for coexistence patterns.",
            " NG911 increases multimedia volume CAD screens were not designed to intake alone.",
        ],
        "ng911-for-small-psaps": [
            " Smaller PSAPs face the same multimedia expectations with fewer IT staff.",
            " NG911 readiness is a network upgrade; workflow software is a separate decision.",
            " Start with transcription and secure media intake before full ESInet cutover.",
            " [NG911 software](/ng911-software) planning should include dispatcher UX.",
        ],
        "campus-safety-reporting-software-cost": [
            " Pricing varies by buildings, integrations, and support tier.",
            " Compare per-building activation versus per-student licensing.",
            " See [pricing](/pricing) and scope a pilot before multi-year commits.",
            " Factor training and Clery workflow review into TCO.",
        ],
        "stadium-incident-reporting-software-cost": [
            " Venue pricing often ties to zones, events per year, and integrations.",
            " Budget for signage, QR/NFC placement, and game-day staffing workflows.",
            " [Contact sales](/contact-sales) for venue-specific scopes.",
            " Measure cost against reduced search time and liability exposure.",
        ],
        "public-safety-software-deployment-time": [
            " Core PSAP pilots can go live in weeks when APIs and SSO are ready.",
            " Campus and venue rollouts depend on signage and zone mapping.",
            " Parallel pilots beat big-bang cutovers for public safety.",
            " Deployment calendars should include supervisor training and QA sampling.",
        ],
        "public-safety-cad-telephony-integration": [
            " Integration questions should be answered before RFP scoring.",
            " Telephony remains authoritative for call control and recording.",
            " CAD exports and incident IDs should link to intelligence-layer events.",
            " [CAD integration](/cad-integration) documents coexistence patterns Rapid Cortex uses.",
        ],
    }

    extra_list = extras.get(slug, ["", "", "", ""])
    core = p1_cores.get(section_idx, p1_cores[3])
    extra = extra_list[section_idx] if section_idx < len(extra_list) else ""

    if section_idx == 0 and focus.lower() not in heading.lower():
        heading_note = (
            f" This section focuses on {focus} because that phrase matches how "
            f"teams search when the problem surfaces in operations."
        )
    else:
        heading_note = ""

    addenda = HUB_SECTION_ADDENDA.get(hub, HUB_SECTION_ADDENDA["Buyer Intent"])
    section_addenda = format_addenda(entry, addenda[section_idx] if section_idx < len(addenda) else addenda[-1])

    paragraphs = [expand_paragraph(core, entry, extra + heading_note)]
    for addendum in section_addenda:
        paragraphs.append(expand_paragraph(addendum, entry))
    paragraphs.append(expand_paragraph(section_depth_paragraph(entry, section_idx), entry))

    return paragraphs


def section_list(entry: dict[str, str], section_idx: int) -> list[str] | None:
    if section_idx not in (0, 2):
        return None
    focus = entry["seoFocus"]
    hub = entry["hub"]
    if hub == "911, PSAP & NG911":
        return [
            f"Live {focus} during active calls without replacing telephony",
            "Secure caller photo and video intake with audit logging",
            "Supervisor dashboards that reduce screen sprawl",
            "Shift handoff logs that preserve incident context",
        ]
    if hub == "Campus Safety":
        return [
            f"QR, NFC, and SMS paths for {focus}",
            "Building-level routing to campus police and residence life",
            "Clery-aware documentation hooks for compliance staff",
            "Integrations with mass notification and access control",
        ]
    if hub in ("Venue Safety", "Airport Safety"):
        return [
            f"Zone-based {focus} from parking to concourse",
            "Fan and passenger signage with QR and NFC",
            "Photo and location intake for roaming security",
            "Documented 911 escalation when events exceed on-site capacity",
        ]
    if hub == "Leadership & Buying":
        return [
            f"CJIS-aware design for {focus} evaluations",
            "Pilot scopes that run parallel to CAD and telephony",
            "Interoperability requirements in RFP language",
            "ROI metrics tied to time-to-context and documentation quality",
        ]
    return [
        f"Clear definition of {focus} versus CAD-only workflows",
        "Integration requirements with existing telephony",
        "Pilot success criteria and rollback plans",
        "Vendor references from similar agency types",
    ]


def generate_intro(entry: dict[str, str]) -> str:
    focus = entry["seoFocus"]
    title = entry["title"]
    hub = entry["hub"]
    links = HUB_INTRO_LINKS[hub]
    link_phrase = f"{links[0]}, {links[1]}, and {links[2]}"
    audience = HUB_CONTEXT[hub]
    return (
        f"{title} is a practical question for {audience} modernizing how incident information moves. "
        f"{focus} only matters when it shortens the path from report to trained responder — "
        f"without replacing CAD, telephony, dispatchers, or medical direction. "
        f"Explore {link_phrase} to see how Rapid Cortex approaches the workflow, "
        f"and scope a pilot when you are ready to measure time-to-context on your own floor."
    )


def generate_closing(entry: dict[str, str]) -> str:
    focus = entry["seoFocus"]
    hub = entry["hub"]
    if hub == "Buyer Intent":
        return (
            f"Strong {focus} evaluations end with written integration requirements and a pilot scorecard — "
            f"[contact sales](/contact-sales) when you want those mapped to Rapid Cortex Core, Campus, or Venue."
        )
    return (
        f"Strong {focus} programs measure time-to-context, not tool count — "
        f"and Rapid Cortex is built to prove that difference in a [free 60-day pilot](/free-60-day-pilot)."
    )


def generate_sections(entry: dict[str, str]) -> list[dict[str, Any]]:
    headings = section_headings(entry)
    sections: list[dict[str, Any]] = []
    callout = COMPLIANCE_CALLOUT_SLUGS.get(entry["slug"])

    for idx, heading in enumerate(headings):
        section: dict[str, Any] = {
            "heading": heading,
            "paragraphs": section_paragraphs(entry, heading, idx),
        }
        lst = section_list(entry, idx)
        if lst:
            section["list"] = lst
        if callout and idx == 2:
            section["callout"] = callout
        sections.append(section)

    return sections


def generate_post_content(entry: dict[str, str]) -> dict[str, Any]:
    return {
        "intro": generate_intro(entry),
        "sections": generate_sections(entry),
        "closing": generate_closing(entry),
    }


def render_section(section: dict[str, Any], indent: str) -> list[str]:
    lines = [f"{indent}{{", f'{indent}  heading: {ts_string(section["heading"])},']
    lines.append(f"{indent}  paragraphs: [")
    for paragraph in section["paragraphs"]:
        lines.append(f"{indent}    {ts_string(paragraph)},")
    lines.append(f"{indent}  ],")

    if section.get("list"):
        lines.append(f"{indent}  list: [")
        for item in section["list"]:
            lines.append(f"{indent}    {ts_string(item)},")
        lines.append(f"{indent}  ],")

    if section.get("callout"):
        callout = section["callout"]
        lines.extend(
            [
                f"{indent}  callout: {{",
                f'{indent}    tone: {ts_string(callout["tone"])},',
                f'{indent}    label: {ts_string(callout["label"])},',
                f'{indent}    text: {ts_string(callout["text"])},',
                f"{indent}  }},",
            ]
        )

    lines.append(f"{indent}}},")
    return lines


def render_ts(content_map: dict[str, dict[str, Any]]) -> str:
    lines = [
        'import type { SeoPostContent } from "./build-seo-post";',
        "",
        "export const seoPostContent: Record<string, SeoPostContent> = {",
    ]

    for entry in ENTRIES:
        slug = entry["slug"]
        content = content_map[slug]
        lines.append(f"  {ts_string(slug)}: {{")
        lines.append(f"    intro: {ts_string(content['intro'])},")
        lines.append("    sections: [")
        for section in content["sections"]:
            lines.extend(render_section(section, "      "))
        lines.append("    ],")
        lines.append(f"    closing: {ts_string(content['closing'])},")
        lines.append("  },")

    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def validate_word_counts(content_map: dict[str, dict[str, Any]]) -> None:
    for entry in ENTRIES:
        content = content_map[entry["slug"]]
        parts = [content["intro"], content.get("closing", "")]
        for section in content["sections"]:
            parts.extend(section["paragraphs"])
            parts.extend(section.get("list", []))
            if section.get("callout"):
                parts.append(section["callout"]["text"])
        total = word_count(" ".join(parts))
        if total < 800:
            raise ValueError(f"{entry['slug']} only {total} words (minimum 800)")
        if total > 1300:
            raise ValueError(f"{entry['slug']} has {total} words (maximum 1300)")


def main() -> None:
    if len(ENTRIES) != 67:
        raise SystemExit(f"Expected 67 entries, found {len(ENTRIES)}")

    content_map = {entry["slug"]: generate_post_content(entry) for entry in ENTRIES}
    validate_word_counts(content_map)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_ts(content_map), encoding="utf-8")
    line_count = len(OUTPUT_PATH.read_text(encoding="utf-8").splitlines())
    print(f"Wrote {OUTPUT_PATH} ({line_count} lines)")


if __name__ == "__main__":
    main()
