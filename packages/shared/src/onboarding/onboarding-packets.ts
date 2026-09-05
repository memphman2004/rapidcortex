import { z } from "zod";
import { normalizeSessionRole } from "../auth/rapid-cortex-roles.js";

export const ONBOARDING_PACKET_VERTICALS = [
  "campus",
  "venue",
  "hospital",
  "transit",
  "psap",
] as const;

export type OnboardingPacketVertical = (typeof ONBOARDING_PACKET_VERTICALS)[number];

export const ONBOARDING_PACKETS_S3_PREFIX = "onboarding-packets";

export const onboardingPacketVerticalSchema = z.enum(ONBOARDING_PACKET_VERTICALS);

export const onboardingPacketDownloadBodySchema = z
  .object({
    vertical: onboardingPacketVerticalSchema,
    key: z.string().trim().min(1).max(512),
  })
  .strict();

export type OnboardingPacketDownloadBody = z.infer<typeof onboardingPacketDownloadBodySchema>;

export const ONBOARDING_PACKET_VERTICAL_LABELS: Record<OnboardingPacketVertical, string> = {
  campus: "Campus Safety",
  venue: "Venue Operations",
  hospital: "Hospital Routing",
  transit: "Transit Operations",
  psap: "PSAP / 911 Dispatch",
};

const RC_PACKET_ROLES = new Set(["rcsuperadmin", "rcadmin", "rcitadmin"]);

const ROLE_PACKET_VERTICAL: Record<string, OnboardingPacketVertical> = {
  campus_admin: "campus",
  venue_admin: "venue",
  hospital_admin: "hospital",
  hospitaladmin: "hospital",
  transit_admin: "transit",
  agencyadmin: "psap",
  agencyit: "psap",
};

/** RC operators see every vertical folder. Vertical admins see only theirs. */
export function onboardingPacketVerticalsForRole(role: string): OnboardingPacketVertical[] {
  const normalized = String(normalizeSessionRole(role)).toLowerCase();
  if (RC_PACKET_ROLES.has(normalized)) {
    return [...ONBOARDING_PACKET_VERTICALS];
  }
  const vertical = ROLE_PACKET_VERTICAL[normalized];
  return vertical ? [vertical] : [];
}

export function canViewOnboardingPacketVertical(role: string, vertical: string): boolean {
  return onboardingPacketVerticalsForRole(role).includes(vertical as OnboardingPacketVertical);
}

const ALLOWED_PACKET_EXT = new Set([
  "md",
  "pdf",
  "docx",
  "pptx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "csv",
  "xlsx",
]);

/**
 * Object keys must stay under `onboarding-packets/{vertical}/…` with no `..`.
 */
export function isSafeOnboardingPacketKey(key: string, vertical: OnboardingPacketVertical): boolean {
  const trimmed = key.trim();
  const prefix = `${ONBOARDING_PACKETS_S3_PREFIX}/${vertical}/`;
  if (!trimmed.startsWith(prefix)) return false;
  if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("//")) return false;
  const rest = trimmed.slice(prefix.length);
  if (!rest || rest.startsWith("/") || rest.endsWith("/")) return false;
  if (rest.split("/").length > 4) return false;
  if (!/^[A-Za-z0-9._\- /]+$/.test(rest)) return false;
  const ext = rest.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_PACKET_EXT.has(ext);
}

export type BundledOnboardingPacketFile = {
  fileName: string;
  title: string;
  contentType: string;
  markdown: string;
};

export type BundledOnboardingPacketFolder = {
  vertical: OnboardingPacketVertical;
  title: string;
  summary: string;
  files: BundledOnboardingPacketFile[];
};

function mdFile(fileName: string, title: string, markdown: string): BundledOnboardingPacketFile {
  return { fileName, title, contentType: "text/markdown; charset=utf-8", markdown };
}

export function bundledPacketFolder(
  vertical: OnboardingPacketVertical,
): BundledOnboardingPacketFolder | undefined {
  return getBundledOnboardingPackets().find((folder) => folder.vertical === vertical);
}

export function bundledPacketFile(
  vertical: OnboardingPacketVertical,
  fileName: string,
): BundledOnboardingPacketFile | undefined {
  return bundledPacketFolder(vertical)?.files.find((file) => file.fileName === fileName);
}

export function bundledPacketS3Key(vertical: OnboardingPacketVertical, fileName: string): string {
  return `${ONBOARDING_PACKETS_S3_PREFIX}/${vertical}/${fileName}`;
}

const CAMPUS_OVERVIEW = `# Rapid Cortex — Campus Safety

Rapid Cortex is **campus public-safety intelligence**. It helps campus safety, dispatch, counseling, and administrators see incidents, buildings, QR locations, and cameras across **every campus in the same tenant**.

## This is not

- A 911 / PSAP CAD console
- A replacement for campus PD radio, telephony, or medical direction
- An automatic door-lockdown system
- A Clery Act filing or Timely Warning system

## Multi-campus

One Rapid Cortex tenant holds every campus (for example Bloomington, Indianapolis, South Bend). Operators use **All campuses** by default and can filter to one location. Buildings, QR codes, cameras, and incidents are tagged to a campus.

## Who this packet is for

Share these files with the campus implementation lead, public-safety leadership, IT/IdP, VMS owner, and Clery coordinator.
`;

const CAMPUS_WHAT_WE_NEED = `# Campus — information we need

Complete **Onboarding Intake** and the **Integration Questionnaire** in Rapid Cortex (Campus Admin → Configuration). Saving the questionnaire publishes the campus list used by every dashboard. It does **not** turn on CAD write-back.

## Campuses and locations

- Official name, short code, city/state, and kind (main / regional / medical / research) for **each** campus
- Estimated buildings, student and staff headcount
- Building list so we can assign each building to a campus

## Identity

- IdP (Shibboleth/InCommon, Entra ID, Okta, Duo, other)
- SAML or OIDC; metadata URL and entity ID
- MFA requirement; JIT vs SCIM vs manual invites
- SIS / HRMS name (Banner, Workday, PeopleSoft, …)

## Video

- VMS of record (Milestone, Hanwha, Genetec, Avigilon, other) and version
- Estimated camera count; who owns privacy masks in the VMS
- Rapid Cortex connects to your VMS. We do not replace it.

## Access control, ALPR, CAD/RMS

- Access control (CBORD, Lenel, Software House, other) and estimated doors
- ALPR (Flock, Genetec AutoVu, other)
- Campus PD CAD and RMS vendors
- Whether CAD write-back is **desired later** (planning only — stays off until a signed addendum)

## Other systems

Alarms, digital signage, weather, EOC, ITSM, patrol/field, mass notification.

## People and network

- Implementation lead name, email, phone
- EAP library owner; Clery coordinator; counselor routing contact
- Firewall contact; webhook allowlist CIDRs; target go-live and change window
`;

const CAMPUS_ROLES = `# Campus roles and dashboards

| Role | Home | Sees all campuses |
| --- | --- | --- |
| Campus Admin | Campus console + settings | Yes |
| Campus Supervisor | Campus safety console | Yes |
| Campus Security | Safety console | Yes |
| Campus Dispatch | Incident queue (not 911 CAD) | Yes |
| Campus Counselor | Wellness queue | Yes |
| Campus Faculty | Limited safety view | Yes |

The campus filter in the header applies across incidents, buildings, cameras, QR locations, and analytics.

QR / NFC management is for campus (and venue) operators — not PSAP dispatcher roles.
`;

const CAMPUS_INTEGRATIONS = `# Campus integrations and hard limits

## Lockdown

Rapid Cortex **never auto-locks doors**. Every lockdown requires an on-duty operator to confirm.

## Clery

Keyword categories are **suggestions only**. A CSA must review. Rapid Cortex never auto-files Clery determinations and never issues Timely Warnings.

## CAD write-back

Fail-closed at every layer. The questionnaire may record that the campus **wants** write-back discussed. Saving the form does not enable it. Production enablement requires a signed addendum.

## Video

Live video is consent-based and tied to an active incident. Agency Nest / Ring Connect follows existing Connect policy. Privacy masks stay in the VMS of record.
`;

const CAMPUS_GO_LIVE = `# Campus go-live checklist

1. Tenant created; campus codes listed in the Integration Questionnaire
2. SSO metadata exchanged; MFA confirmed; first Campus Admin can sign in
3. Buildings assigned to campuses; QR/NFC print pack reviewed
4. VMS connectivity (or documented deferral); camera registry started
5. Access-control / ALPR / CAD notes captured; lockdown and Clery acknowledgements signed in the questionnaire
6. EAP library owner and Clery coordinator named
7. Firewall / webhook allowlist in place
8. Tabletop: create a test incident, switch campuses, scan a QR, confirm counseling routing
9. Go-live window agreed; Rapid Cortex implementation lead on standby
`;

const VENUE_OVERVIEW = `# Rapid Cortex — Venue Operations

Rapid Cortex Venue is **event and facility operations intelligence** for arenas, stadiums, and similar sites.

**Every venue page must make clear this is not a 911 emergency dispatch system.** Guest Services especially: guest reports are hospitality/operations, not CAD.

Rapid Cortex does not replace the venue’s VMS, access control, or public-safety CAD.
`;

const VENUE_WHAT_WE_NEED = `# Venue — information we need

Complete **Venue Onboarding Intake** in Rapid Cortex.

- Venue legal name, code, city, typical event types and capacity
- Zones / sections map; guest-services vs security org chart
- IdP / SSO if staff will federate
- VMS vendor and camera estimate; who approves live-view during incidents
- QR / NFC placement plan (gates, suites, concourse, parking)
- Public-safety partner PSAP / campus PD and how you escalate
- Implementation lead, target go-live, change window
`;

const VENUE_ROLES = `# Venue roles

Venue Admin, Supervisor, Security, Operator, and Guest Services each have a dedicated console. Guest Services is labeled **not a 911 emergency dispatch system** on every page. Operators manage cameras and QR; they do not get a PSAP incident table or CAD write-back.
`;

const VENUE_GO_LIVE = `# Venue go-live checklist

1. Intake saved; zones named
2. Staff roles provisioned; Guest Services disclaimer visible
3. QR print pack at gates / suites
4. Camera registry or documented VMS deferral
5. Escalation path to public safety agreed
6. Event-day tabletop before first gated event
`;

const HOSPITAL_OVERVIEW = `# Rapid Cortex — Hospital Routing

Hospital Admin and Staff use a **capacity and routing portal**. This is not a 911 dispatch workspace and not medical direction.

Rapid Cortex can share inbound EMS awareness with participating hospitals. It does not replace the hospital’s EHR, bed-management system, or medical control.
`;

const HOSPITAL_WHAT_WE_NEED = `# Hospital — information we need

- Facility name(s), trauma / specialty designations, diversion contacts
- Who updates capacity (admin vs staff vs coordinator)
- Regional routing partners and any existing pre-alert process
- SSO / IdP if required
- HL7 or other ADT interest (planning only until scoped)
- Implementation lead and go-live window
`;

const HOSPITAL_GO_LIVE = `# Hospital go-live checklist

1. Hospital tenant and roles provisioned
2. Capacity board owners trained
3. Routing / regional map contacts confirmed
4. Tabletop with a partner PSAP or EMS agency
`;

const TRANSIT_OVERVIEW = `# Rapid Cortex — Transit Operations

Transit Admin, Supervisor, Security, and Operator consoles cover fleet, routes, and on-system incidents.

This is **not** a replacement for transit CAD, radio, or the region’s 911 PSAP. Escalation off the system follows the agency’s existing public-safety agreements.
`;

const TRANSIT_WHAT_WE_NEED = `# Transit — information we need

- Agency name, modes (bus, rail, ferry), yard / station list
- Fleet inventory source of truth; camera / VMS if used on vehicles or stations
- Operator vs security vs supervisor responsibilities
- SSO; radio / CAD partner if any
- Implementation lead and go-live window
`;

const TRANSIT_GO_LIVE = `# Transit go-live checklist

1. Tenant and transit roles provisioned
2. Vehicles / routes loaded or deferred in writing
3. Camera plan for stations / fleet
4. Tabletop: in-service incident → security → public safety
`;

const PSAP_OVERVIEW = `# Rapid Cortex — PSAP / 911

Rapid Cortex **enhances** emergency communications. It does **not** replace CAD, telephony, dispatchers, or medical direction.

CAD write-back is **off by default** everywhere and stays off until a signed addendum and an explicit production go/no-go.
`;

const PSAP_WHAT_WE_NEED = `# PSAP — information we need

Use the agency implementation workbook and Admin → Pilot hub.

- Jurisdiction slug(s); executive sponsor, IT/security, floor supervisor, training lead
- User-role mapping (dispatcher, supervisor, agency admin, IT, analyst, auditor)
- Protocol pack ownership and change control
- Multilingual / voice scope
- CAD vendor and whether write-back will even be *discussed* (still fail-closed)
- Privacy / retention decisions
- SSO / MFA; network allowlists
`;

const PSAP_GO_LIVE = `# PSAP go-live checklist

1. Signed pilot / SOW reflects assistive posture
2. Agency row, Cognito roles, CORS, and secrets confirmed
3. Privacy, protocol, multilingual, and role checkpoints signed
4. Smoke: create/list/open incident, transcript, analysis
5. CAD write-back remains off unless addendum + go/no-go are complete
6. Support path and success review cadence scheduled
`;

export function getBundledOnboardingPackets(): BundledOnboardingPacketFolder[] {
  return [
    {
      vertical: "campus",
      title: "Campus Safety",
      summary:
        "Customer packet for university and school public-safety programs: what Rapid Cortex is, what to collect, integrations, and go-live.",
      files: [
        mdFile(
          "00-overview.md",
          "Campus overview — what Rapid Cortex is and is not",
          CAMPUS_OVERVIEW,
        ),
        mdFile("01-what-we-need.md", "Information we need to integrate you", CAMPUS_WHAT_WE_NEED),
        mdFile("02-roles-and-dashboards.md", "Roles and dashboards", CAMPUS_ROLES),
        mdFile("03-integrations-and-limits.md", "Integrations and hard limits", CAMPUS_INTEGRATIONS),
        mdFile("04-go-live.md", "Go-live checklist", CAMPUS_GO_LIVE),
      ],
    },
    {
      vertical: "venue",
      title: "Venue Operations",
      summary:
        "Customer packet for arenas, stadiums, and campuses-of-events: guest reporting, cameras, QR, and the 911 disclaimer.",
      files: [
        mdFile("00-overview.md", "Venue overview — what Rapid Cortex is and is not", VENUE_OVERVIEW),
        mdFile("01-what-we-need.md", "Information we need to integrate you", VENUE_WHAT_WE_NEED),
        mdFile("02-roles-and-operations.md", "Roles and operations", VENUE_ROLES),
        mdFile("03-go-live.md", "Go-live checklist", VENUE_GO_LIVE),
      ],
    },
    {
      vertical: "hospital",
      title: "Hospital Routing",
      summary: "Customer packet for hospital capacity and EMS routing — not a 911 dispatch console.",
      files: [
        mdFile("00-overview.md", "Hospital overview", HOSPITAL_OVERVIEW),
        mdFile("01-what-we-need.md", "Information we need to integrate you", HOSPITAL_WHAT_WE_NEED),
        mdFile("02-go-live.md", "Go-live checklist", HOSPITAL_GO_LIVE),
      ],
    },
    {
      vertical: "transit",
      title: "Transit Operations",
      summary: "Customer packet for transit agencies: fleet, routes, and operator safety — not CAD.",
      files: [
        mdFile("00-overview.md", "Transit overview", TRANSIT_OVERVIEW),
        mdFile("01-what-we-need.md", "Information we need to integrate you", TRANSIT_WHAT_WE_NEED),
        mdFile("02-go-live.md", "Go-live checklist", TRANSIT_GO_LIVE),
      ],
    },
    {
      vertical: "psap",
      title: "PSAP / 911 Dispatch",
      summary:
        "Customer packet for PSAPs and emergency communications centers. Rapid Cortex assists dispatchers; it does not replace CAD, telephony, or medical direction.",
      files: [
        mdFile("00-overview.md", "PSAP overview — assistive posture", PSAP_OVERVIEW),
        mdFile("01-what-we-need.md", "Information we need to integrate you", PSAP_WHAT_WE_NEED),
        mdFile("02-go-live.md", "Go-live checklist", PSAP_GO_LIVE),
      ],
    },
  ];
}

export const BUNDLED_ONBOARDING_PACKETS = getBundledOnboardingPackets();
