import { z } from "zod";
import { guestAssistVerticalSchema, type GuestAssistVertical } from "./schemas.js";

const fact = z.string().trim().max(4000).default("");
const shortFact = z.string().trim().max(500).default("");
const phoneFact = z.string().trim().max(32).default("");

const sharedFacts = {
  hoursOfOperation: shortFact,
  nonEmergencyPhone: phoneFact,
};

export const venueGuestAssistKnowledgeSchema = z
  .object({
    ...sharedFacts,
    directions: fact,
    "venue-info": fact,
    "guest-svc": fact,
    "lost-found": fact,
    issue: fact,
    general: fact,
  })
  .strip();

export const campusGuestAssistKnowledgeSchema = z
  .object({
    ...sharedFacts,
    directions: fact,
    "student-svc": fact,
    safety: fact,
    issue: fact,
    events: fact,
    "lost-found": fact,
  })
  .strip();

export const transitGuestAssistKnowledgeSchema = z
  .object({
    ...sharedFacts,
    "trip-plan": fact,
    schedules: fact,
    fares: fact,
    access: fact,
    issue: fact,
    alerts: fact,
  })
  .strip();

export type VenueGuestAssistKnowledge = z.infer<typeof venueGuestAssistKnowledgeSchema>;
export type CampusGuestAssistKnowledge = z.infer<typeof campusGuestAssistKnowledgeSchema>;
export type TransitGuestAssistKnowledge = z.infer<typeof transitGuestAssistKnowledgeSchema>;

export type GuestAssistKnowledge =
  | VenueGuestAssistKnowledge
  | CampusGuestAssistKnowledge
  | TransitGuestAssistKnowledge;

export type GuestAssistKnowledgeField = {
  key: string;
  label: string;
  hint: string;
  placeholder: string;
  input: "text" | "textarea";
};

const SHARED_FIELDS: readonly GuestAssistKnowledgeField[] = [
  {
    key: "hoursOfOperation",
    label: "Hours of operation",
    hint: "When Guest Assist answers should assume this location is open. Include event-day vs non-event hours if they differ.",
    placeholder: "Gates 90 minutes before kickoff; concourse until 1 hour after.",
    input: "text",
  },
  {
    key: "nonEmergencyPhone",
    label: "Non-emergency help number",
    hint: "Published number Guest Assist should give when the guest needs a person. Not 911.",
    placeholder: "(555) 010-0100",
    input: "text",
  },
];

export const GUEST_ASSIST_KNOWLEDGE_FIELDS: Record<
  GuestAssistVertical,
  readonly GuestAssistKnowledgeField[]
> = {
  venue: [
    ...SHARED_FIELDS,
    {
      key: "directions",
      label: "Directions",
      hint: "Gates, restrooms, parking, first aid, exits, and landmarks from typical scan spots.",
      placeholder: "Nearest restrooms are behind section 112. First aid is Gate C, street level.",
      input: "textarea",
    },
    {
      key: "venue-info",
      label: "Venue info",
      hint: "Re-entry, bag policy, prohibited items, event schedule, will-call windows.",
      placeholder: "Clear bags only, 12×6×12. No re-entry after the third quarter.",
      input: "textarea",
    },
    {
      key: "guest-svc",
      label: "Guest services",
      hint: "ADA seating, stroller check, sensory rooms, guest services desks.",
      placeholder: "Guest Services desk at Gate B. Wheelchair escort: radio Guest Services.",
      input: "textarea",
    },
    {
      key: "lost-found",
      label: "Lost & found",
      hint: "Where items go, hours, and what to do for a lost child.",
      placeholder: "Lost & Found at Guest Services, Gate B, until 1 hour after the event.",
      input: "textarea",
    },
    {
      key: "issue",
      label: "Report an issue",
      hint: "Who handles spills, broken seats, restroom outages, and how staff are reached.",
      placeholder: "Spills: radio Housekeeping. Broken seats: Section staff, then Operations.",
      input: "textarea",
    },
    {
      key: "general",
      label: "General help",
      hint: "Concessions, ATMs, merchandise, rideshare pickup, other guest FAQs.",
      placeholder: "Rideshare pickup is Lot G, south of Gate D. ATMs on the main concourse.",
      input: "textarea",
    },
  ],
  campus: [
    ...SHARED_FIELDS,
    {
      key: "directions",
      label: "Directions",
      hint: "Buildings, parking, transit stops, and how to read campus maps from common QR spots.",
      placeholder: "Student Union is across the quad from the library. Visitor parking in Lot A.",
      input: "textarea",
    },
    {
      key: "student-svc",
      label: "Student services",
      hint: "Registrar, financial aid, health, counseling, disability services — building, hours, after-hours.",
      placeholder: "Registrar: Student Services 1st floor, Mon–Fri 8–5. Counseling: 24/7 line …",
      input: "textarea",
    },
    {
      key: "safety",
      label: "Safety & security",
      hint: "Safe walk, non-emergency police, alert sign-up, parking enforcement. 911 stays for danger.",
      placeholder: "Safe walk: call Campus Safety at … Officers will meet at the listed location.",
      input: "textarea",
    },
    {
      key: "issue",
      label: "Report an issue",
      hint: "Facilities, lighting, accessibility barriers, and how work orders are logged.",
      placeholder: "Facilities work orders via the campus app. After hours: Campus Safety can radio.",
      input: "textarea",
    },
    {
      key: "events",
      label: "Campus events",
      hint: "Where the official calendar lives and any standing events Guest Assist should know.",
      placeholder: "Events calendar: events.campus.edu. Athletics: athletics.campus.edu/schedule.",
      input: "textarea",
    },
    {
      key: "lost-found",
      label: "Lost & found",
      hint: "Lost items, IDs, and after-hours drop-off.",
      placeholder: "Lost & Found at the Student Union information desk. Lost IDs: Card Office.",
      input: "textarea",
    },
  ],
  transit: [
    ...SHARED_FIELDS,
    {
      key: "trip-plan",
      label: "Trip planning",
      hint: "Main lines, transfer points, last trips, and the official trip planner URL/app.",
      placeholder: "Trip planner: app.example.com. Last downtown train weeknights is 12:15 a.m.",
      input: "textarea",
    },
    {
      key: "schedules",
      label: "Schedules",
      hint: "Service hours, weekend/holiday differences, real-time board or app name.",
      placeholder: "Weekday service 5 a.m.–1 a.m. Real-time departures in the rider app.",
      input: "textarea",
    },
    {
      key: "fares",
      label: "Fares & passes",
      hint: "Single-ride price, passes, how to pay, reduced fare. Note if prices change often.",
      placeholder: "Single ride $2.50 tap-to-pay. Monthly pass in the rider app. Reduced fare ID required.",
      input: "textarea",
    },
    {
      key: "access",
      label: "Accessibility",
      hint: "Elevators, wheelchair boarding, paratransit number, how to request assistance.",
      placeholder: "Elevator status: status.example.com. Paratransit: (555) 010-0200.",
      input: "textarea",
    },
    {
      key: "issue",
      label: "Report an issue",
      hint: "Broken elevators, platform hazards, overcrowding — who is notified besides 911.",
      placeholder: "Platform hazards: Transit Control. Elevator outages posted on the station board.",
      input: "textarea",
    },
    {
      key: "alerts",
      label: "Service alerts",
      hint: "Where live delays/detours are published and any standing disruptions.",
      placeholder: "Live alerts: alerts.example.com and station PA. Weekend Red Line shuttle …",
      input: "textarea",
    },
  ],
};

export function emptyVenueGuestAssistKnowledge(): VenueGuestAssistKnowledge {
  return venueGuestAssistKnowledgeSchema.parse({});
}

export function emptyCampusGuestAssistKnowledge(): CampusGuestAssistKnowledge {
  return campusGuestAssistKnowledgeSchema.parse({});
}

export function emptyTransitGuestAssistKnowledge(): TransitGuestAssistKnowledge {
  return transitGuestAssistKnowledgeSchema.parse({});
}

export function emptyGuestAssistKnowledge(vertical: GuestAssistVertical): GuestAssistKnowledge {
  if (vertical === "venue") return emptyVenueGuestAssistKnowledge();
  if (vertical === "campus") return emptyCampusGuestAssistKnowledge();
  return emptyTransitGuestAssistKnowledge();
}

export function mergeVenueGuestAssistKnowledge(value: unknown): VenueGuestAssistKnowledge {
  return venueGuestAssistKnowledgeSchema.parse(value && typeof value === "object" ? value : {});
}

export function mergeCampusGuestAssistKnowledge(value: unknown): CampusGuestAssistKnowledge {
  return campusGuestAssistKnowledgeSchema.parse(value && typeof value === "object" ? value : {});
}

export function mergeTransitGuestAssistKnowledge(value: unknown): TransitGuestAssistKnowledge {
  return transitGuestAssistKnowledgeSchema.parse(value && typeof value === "object" ? value : {});
}

export function mergeGuestAssistKnowledge(
  vertical: GuestAssistVertical,
  value: unknown,
): GuestAssistKnowledge {
  if (vertical === "venue") return mergeVenueGuestAssistKnowledge(value);
  if (vertical === "campus") return mergeCampusGuestAssistKnowledge(value);
  return mergeTransitGuestAssistKnowledge(value);
}
