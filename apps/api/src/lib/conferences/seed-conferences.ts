import {
  PLATFORM_CONFERENCE_AGENCY_ID,
  type Conference,
  type ConferencePriority,
} from "rapid-cortex-shared";
import { ConferenceRepository } from "../../repositories/conferenceRepository.js";

type SeedRow = Pick<
  Conference,
  | "conferenceId"
  | "name"
  | "website"
  | "sourceUrl"
  | "alternateSourceUrls"
  | "startDate"
  | "endDate"
  | "location"
  | "venue"
  | "registrationFee"
  | "boothFee"
  | "vertical"
  | "priority"
  | "notes"
>;

export const DEFAULT_CONFERENCES: SeedRow[] = [
  {
    conferenceId: "conf-gecc-2027",
    name: "Georgia Emergency Communications Conference (GECC)",
    website: "https://ga911.com",
    sourceUrl: "https://ga911.com",
    startDate: "2027-03-07",
    endDate: "2027-03-11",
    location: "Columbus, Georgia",
    venue: "Columbus Georgia Convention & Trade Center",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "911",
    priority: "green",
    notes: "Exhibit — flagship state 911 show. Booth + live Core demo + 60-day pilot push.",
  },
  {
    conferenceId: "conf-nena-2027",
    name: "NENA Annual Conference & Expo 2027",
    website: "https://www.nena.org/page/Conference",
    sourceUrl: "https://www.nena.org/page/Conference",
    startDate: "2027-06-26",
    endDate: "2027-07-01",
    location: "Nashville, Tennessee",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "911",
    priority: "green",
    notes: "Exhibit — national 911 / NG911 / PSAP must-attend.",
  },
  {
    conferenceId: "conf-apco-2027",
    name: "APCO International Conference 2027",
    website: "https://www.apco911.org/annual-conference",
    sourceUrl: "https://www.apco911.org/annual-conference",
    startDate: "2027-07-25",
    endDate: "2027-07-28",
    location: "Anaheim, California",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "911",
    priority: "green",
    notes: "Exhibit — national ECC/PSAP reach. Target a panel, not booth-only.",
  },
  {
    conferenceId: "conf-ncs4-2027",
    name: "NCS⁴ National Sports Safety & Security Conference",
    website: "https://ncs4.usm.edu/events/annual-conference/",
    sourceUrl: "https://ncs4.usm.edu/events/annual-conference/",
    startDate: "2027-06-22",
    endDate: "2027-06-24",
    location: "Miami, Florida",
    venue: "JW Marriott Miami Turnberry Resort & Spa",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "venue",
    priority: "green",
    notes: "Exhibit — best Venue fit; overlaps IACLEA (needs a second team).",
  },
  {
    conferenceId: "conf-iaclea-2027",
    name: "IACLEA Annual Conference 2027",
    website: "https://www.iaclea.org/annual-conference",
    sourceUrl: "https://www.iaclea.org/annual-conference",
    startDate: "2027-06-22",
    endDate: "2027-06-25",
    location: "Atlantic City, New Jersey",
    venue: "Atlantic City Convention Center",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "campus",
    priority: "green",
    notes: "Exhibit — strongest Campus law-enforcement show. Overlaps NCS⁴.",
  },
  {
    conferenceId: "conf-la-apco-nena-2027",
    name: "Louisiana APCO/NENA Symposium 2027",
    website: "https://www.louisianaapco.org",
    sourceUrl: "https://www.louisianaapco.org",
    startDate: "2027-04-25",
    endDate: "2027-04-28",
    location: "Lake Charles, Louisiana",
    venue: "Golden Nugget Lake Charles",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "911",
    priority: "amber",
    notes: "Exhibit — Southeast 911. 400+ emergency communications professionals expected.",
  },
  {
    conferenceId: "conf-al-911-2027",
    name: "Alabama 911 Conference",
    website: "https://al911board.alabama.gov",
    sourceUrl: "https://al911board.alabama.gov",
    startDate: "TBD",
    endDate: "TBD",
    location: "TBD",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "911",
    priority: "amber",
    notes: "Track — 2026 was May 4–7, Huntsville. Strong county ECD pilot market.",
  },
  {
    conferenceId: "conf-fl-apco-2027",
    name: "Florida APCO Training Conference & Expo",
    website: "https://www.floridaapco.org",
    sourceUrl: "https://www.floridaapco.org",
    startDate: "TBD",
    endDate: "TBD",
    location: "TBD",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "911",
    priority: "amber",
    notes: "Track — Southeast 911 expansion after GA/AL/LA.",
  },
  {
    conferenceId: "conf-aaae-2027",
    name: "AAAE Annual Conference 2027",
    website: "https://www.aaae.org",
    sourceUrl: "https://www.aaae.org",
    startDate: "2027-05-16",
    endDate: "2027-05-18",
    location: "Phoenix, Arizona",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "airport",
    priority: "amber",
    notes: "Attend first; exhibit if airport-buyer ROI is proven.",
  },
  {
    conferenceId: "conf-gsx-2026",
    name: "GSX 2026 — Global Security Exchange",
    website: "https://www.gsx.org",
    sourceUrl: "https://www.gsx.org",
    startDate: "2026-09-14",
    endDate: "2026-09-16",
    location: "Atlanta, Georgia",
    venue: "Georgia World Congress Center",
    registrationFee: "TBD — not yet published",
    boothFee: "TBD — not yet published",
    vertical: "venue",
    priority: "amber",
    notes: "Attend 2026 (Venue + Campus). Evaluate a 2027 booth from competitive intel.",
  },
  {
    conferenceId: "conf-iacp-2026",
    name: "IACP 2026",
    website: "https://www.theiacpannualconference.org",
    sourceUrl: "https://www.theiacpannualconference.org",
    startDate: "2026-10-12",
    endDate: "2026-10-15",
    location: "TBD",
    vertical: "911",
    priority: "red",
  },
  {
    conferenceId: "conf-campus-safety-2027",
    name: "Campus Safety Conference",
    website: "https://www.campussafetyconference.com",
    sourceUrl: "https://www.campussafetyconference.com",
    startDate: "TBD",
    endDate: "TBD",
    location: "TBD",
    vertical: "campus",
    priority: "red",
  },
  {
    conferenceId: "conf-venuesnow-2026",
    name: "VenuesNow Conference 2026",
    website: "https://www.venuesnow.com/conference",
    sourceUrl: "https://www.venuesnow.com/conference",
    startDate: "2026-09-29",
    endDate: "2026-10-01",
    location: "TBD",
    vertical: "venue",
    priority: "red",
  },
];

function isUnset(value?: string): boolean {
  const t = (value ?? "").trim();
  return t.length === 0 || t.toUpperCase() === "TBD";
}

/** Exhibit/watch colors from the first catalog seed; remapped once to going/maybe/not attending. */
const LEGACY_PRIORITY: Partial<Record<string, ConferencePriority>> = {
  "conf-gecc-2027": "red",
  "conf-nena-2027": "red",
  "conf-apco-2027": "red",
  "conf-ncs4-2027": "red",
  "conf-iaclea-2027": "red",
  "conf-aaae-2027": "green",
  "conf-iacp-2026": "green",
  "conf-campus-safety-2027": "green",
  "conf-venuesnow-2026": "green",
};

function shouldApplySeedPriority(current: Conference, seed: SeedRow): boolean {
  if (!seed.priority) return false;
  if (!current.priority) return true;
  if (current.priority === seed.priority) return false;
  return current.priority === LEGACY_PRIORITY[seed.conferenceId];
}

export function buildSeedConference(seed: SeedRow, nowIso: string): Conference {
  return {
    conferenceId: seed.conferenceId,
    agencyId: PLATFORM_CONFERENCE_AGENCY_ID,
    name: seed.name,
    website: seed.website,
    sourceUrl: seed.sourceUrl,
    alternateSourceUrls: seed.alternateSourceUrls,
    startDate: seed.startDate,
    endDate: seed.endDate,
    location: seed.location,
    venue: seed.venue,
    registrationFee: seed.registrationFee,
    boothFee: seed.boothFee,
    vertical: seed.vertical,
    priority: seed.priority,
    notes: seed.notes,
    changeHistory: [],
    autoUpdateEnabled: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function fillFromSeed(current: Conference, seed: SeedRow, nowIso: string): Conference | null {
  const next: Conference = { ...current };
  let changed = false;

  if (current.name !== seed.name) {
    next.name = seed.name;
    changed = true;
  }
  if (isUnset(current.startDate) && !isUnset(seed.startDate)) {
    next.startDate = seed.startDate;
    changed = true;
  }
  if (isUnset(current.endDate) && !isUnset(seed.endDate)) {
    next.endDate = seed.endDate;
    changed = true;
  }
  if (isUnset(current.location) && !isUnset(seed.location)) {
    next.location = seed.location;
    changed = true;
  }
  if (isUnset(current.venue) && seed.venue) {
    next.venue = seed.venue;
    changed = true;
  }
  if (isUnset(current.website) && seed.website) {
    next.website = seed.website;
    changed = true;
  }
  if (isUnset(current.sourceUrl) && seed.sourceUrl) {
    next.sourceUrl = seed.sourceUrl;
    changed = true;
  }
  if (isUnset(current.registrationFee) && seed.registrationFee) {
    next.registrationFee = seed.registrationFee;
    changed = true;
  }
  if (isUnset(current.boothFee) && seed.boothFee) {
    next.boothFee = seed.boothFee;
    changed = true;
  }
  if (!current.vertical && seed.vertical) {
    next.vertical = seed.vertical;
    changed = true;
  }
  if (shouldApplySeedPriority(current, seed) && seed.priority) {
    next.priority = seed.priority;
    changed = true;
  }
  if (isUnset(current.notes) && seed.notes) {
    next.notes = seed.notes;
    changed = true;
  }

  if (!changed) return null;
  next.updatedAt = nowIso;
  return next;
}

export async function seedConferencesIfEmpty(
  repo = new ConferenceRepository(),
): Promise<Conference[]> {
  const existing = await repo.listByAgency();
  const byId = new Map(existing.map((c) => [c.conferenceId, c]));
  const now = new Date().toISOString();
  let wrote = false;

  for (const row of DEFAULT_CONFERENCES) {
    const current = byId.get(row.conferenceId);
    if (!current) {
      await repo.put(buildSeedConference(row, now));
      wrote = true;
      continue;
    }
    const patched = fillFromSeed(current, row, now);
    if (patched) {
      await repo.put(patched);
      wrote = true;
    }
  }

  return wrote ? repo.listByAgency() : existing;
}
