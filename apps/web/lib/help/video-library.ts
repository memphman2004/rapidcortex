/**
 * NexCort iQ — Training video suggestions for Help / Staff Guide.
 *
 * status:
 *   live     — published URL ready for production library
 *   scripted — script approved; record + caption next
 *   planned  — recommended topic; not yet filmed
 *
 * When `url` is set and status is `live`, Help panel can deep-link.
 * Until then, treat entries as the production recording backlog.
 */

import { normalizeHelpRole } from "./help-content";
import { staffGuideVerticalFromRole, type StaffGuideVertical } from "@/lib/staff-guide/catalog";

export type TrainingVideoStatus = "live" | "scripted" | "planned";

export interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  /** Target runtime for producers */
  duration: string;
  status: TrainingVideoStatus;
  /** Hosted URL when status === "live" */
  url?: string;
  /** Roles / vertical keys that should see this suggestion */
  audiences: string[];
}

const PSAP_VIDEOS: TrainingVideo[] = [
  {
    id: "psap-workspace-tour",
    title: "Dispatcher workspace tour (5 min)",
    description: "Queue, transcript, intelligence panel, Connections health — what to check every shift.",
    duration: "5:00",
    status: "scripted",
    audiences: ["dispatcher", "supervisor", "agencyadmin", "agencyit"],
  },
  {
    id: "psap-first-incident",
    title: "First incident to CAD entry",
    description: "Intake → triage → notes → CAD path with write-back fail-closed called out.",
    duration: "7:00",
    status: "scripted",
    audiences: ["dispatcher", "supervisor"],
  },
  {
    id: "psap-silent-text",
    title: "Silent Text Link — domestic / can’t-speak calls",
    description: "When to send, E.164 number check, reading the thread, audit trail.",
    duration: "4:00",
    status: "scripted",
    audiences: ["dispatcher", "supervisor"],
  },
  {
    id: "psap-video-pinpoint",
    title: "Caller Video Assist + Pinpoint",
    description: "Safe use, SMS failures, indoor GPS limits, SOP overrides.",
    duration: "6:00",
    status: "scripted",
    audiences: ["dispatcher", "supervisor"],
  },
  {
    id: "psap-supervisor-floor",
    title: "Supervisor floor monitoring & CAD approval",
    description: "Watching indicator, empty approval queue when write-back is off, wellness flags.",
    duration: "6:00",
    status: "scripted",
    audiences: ["supervisor", "agencyadmin"],
  },
  {
    id: "psap-admin-users-sop",
    title: "Agency Admin: users, roles, SOP library",
    description: "Invite, deactivate, canonical roles, SOP upload without fabricating protocols.",
    duration: "8:00",
    status: "scripted",
    audiences: ["agencyadmin", "agencyit"],
  },
  {
    id: "psap-analyst-exports",
    title: "Analyst & auditor: reports and compliance exports",
    description: "Agency-scoped CSV, access reports, what not to email.",
    duration: "5:00",
    status: "planned",
    audiences: ["analyst", "auditor"],
  },
];

const CAMPUS_VIDEOS: TrainingVideo[] = [
  {
    id: "campus-overview-911",
    title: "Campus Safety overview + when to call 911",
    description: "Product boundaries, role map, Clery limits, emergency handoff.",
    duration: "6:00",
    status: "scripted",
    audiences: ["campus"],
  },
  {
    id: "campus-qr-nfc",
    title: "Campus QR / NFC: Field-app vs Location QR",
    description: "Create, print, assign cameras, deactivate, reprint.",
    duration: "7:00",
    status: "planned",
    audiences: ["campus"],
  },
  {
    id: "campus-counselor-faculty",
    title: "Counselor wellness queue & Faculty report path",
    description: "Scope limits — no cameras/CAD for counselor; faculty submit/track only.",
    duration: "5:00",
    status: "planned",
    audiences: ["campus"],
  },
];

const VENUE_VIDEOS: TrainingVideo[] = [
  {
    id: "venue-overview-disclaimer",
    title: "Venue ops overview — NOT a 911 dispatch system",
    description: "Guest reports vs emergencies; Guest Services disclaimer on every page.",
    duration: "5:00",
    status: "scripted",
    audiences: ["venue"],
  },
  {
    id: "venue-guest-reports",
    title: "Guest Reports inbox & section incidents",
    description: "QR/NFC/SMS intake, assignment, cameras for awareness only.",
    duration: "6:00",
    status: "planned",
    audiences: ["venue"],
  },
  {
    id: "venue-guest-services",
    title: "Guest Services role walkthrough",
    description: "Inbox-only scope; never present as emergency dispatch.",
    duration: "4:00",
    status: "scripted",
    audiences: ["venue"],
  },
];

const TRANSIT_VIDEOS: TrainingVideo[] = [
  {
    id: "transit-overview-911",
    title: "Transit ops overview + when to call 911",
    description: "Fleet/routes/stations; audit-only escalate; no CAD write-back.",
    duration: "6:00",
    status: "scripted",
    audiences: ["transit"],
  },
  {
    id: "transit-operator-shift",
    title: "Operator shift: vehicle, cameras, report an incident",
    description: "Assigned vehicle view, radio procedures still win, 911 for life safety.",
    duration: "5:00",
    status: "scripted",
    audiences: ["transit"],
  },
  {
    id: "transit-qr-passenger",
    title: "Passenger QR on vehicles and stations",
    description: "Admin/Supervisor create-print-deactivate; operator view-only.",
    duration: "5:00",
    status: "planned",
    audiences: ["transit"],
  },
];

const HOSPITAL_VIDEOS: TrainingVideo[] = [
  {
    id: "hospital-capacity-prealert",
    title: "Capacity updates & EMS pre-alert acknowledgment",
    description: "Staff vs admin duties; stale capacity risk; MCI planning intro.",
    duration: "6:00",
    status: "scripted",
    audiences: ["hospital_admin", "hospital_staff"],
  },
];

const CALL_ASSIST_VIDEOS: TrainingVideo[] = [
  {
    id: "ca-operator-live",
    title: "Call Assist operator: live session & takeover",
    description: "Non-emergency only banner, confidence loops, human takeover.",
    duration: "6:00",
    status: "scripted",
    audiences: ["call_assist_operator", "call_assist_supervisor", "call_assist_admin"],
  },
  {
    id: "ca-emergency-transfer",
    title: "Emergency recognition & Connect transfer",
    description: "Safety Engine stops AI talk; original caller leg to live answer.",
    duration: "5:00",
    status: "scripted",
    audiences: ["call_assist_operator", "call_assist_supervisor", "call_assist_admin"],
  },
  {
    id: "ca-admin-config-demo",
    title: "Admin config, KB grounding, demo runner",
    description: "Disclosure, thresholds, fail-closed CAD, seeded KCPD-style scenarios.",
    duration: "8:00",
    status: "planned",
    audiences: ["call_assist_admin", "call_assist_supervisor"],
  },
];

const RC_VIDEOS: TrainingVideo[] = [
  {
    id: "rc-agency-onboard",
    title: "Onboarding an agency (type, roles, flags)",
    description: "Agency type drives vertical routing; CAD write-back stays fail-closed.",
    duration: "7:00",
    status: "scripted",
    audiences: ["rcadmin", "rcsuperadmin", "rcitadmin"],
  },
  {
    id: "rc-it-support",
    title: "RC IT: MFA re-enrollment & diagnostics",
    description: "Identity verification, no secret dumps, correlation IDs.",
    duration: "5:00",
    status: "planned",
    audiences: ["rcitadmin", "rcadmin", "rcsuperadmin"],
  },
];

export const TRAINING_VIDEO_LIBRARY: TrainingVideo[] = [
  ...PSAP_VIDEOS,
  ...CAMPUS_VIDEOS,
  ...VENUE_VIDEOS,
  ...TRANSIT_VIDEOS,
  ...HOSPITAL_VIDEOS,
  ...CALL_ASSIST_VIDEOS,
  ...RC_VIDEOS,
];

function audienceKeysForRole(role: string): string[] {
  const vertical = staffGuideVerticalFromRole(role);
  if (vertical) return [vertical, normalizeHelpRole(role)];
  return [normalizeHelpRole(role)];
}

/** Videos suggested for a signed-in role (Help panel + Staff Guide). */
export function getTrainingVideosForRole(role: string): TrainingVideo[] {
  const keys = new Set(audienceKeysForRole(role));
  return TRAINING_VIDEO_LIBRARY.filter((video) => video.audiences.some((a) => keys.has(a)));
}

export function getTrainingVideosForVertical(vertical: StaffGuideVertical): TrainingVideo[] {
  return TRAINING_VIDEO_LIBRARY.filter((video) => video.audiences.includes(vertical));
}

export function countVideosByStatus(videos: TrainingVideo[] = TRAINING_VIDEO_LIBRARY): Record<TrainingVideoStatus, number> {
  return videos.reduce(
    (acc, video) => {
      acc[video.status] += 1;
      return acc;
    },
    { live: 0, scripted: 0, planned: 0 } as Record<TrainingVideoStatus, number>,
  );
}
