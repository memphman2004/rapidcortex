import type {
  Conference,
  ConferenceChangeRecord,
  ConferenceChangeType,
  ConferencePriority,
} from "rapid-cortex-shared";

function priorityOf(conf: Pick<Conference, "priority">): ConferencePriority {
  return conf.priority ?? "amber";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  if (value.toUpperCase().includes("TBD")) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

function formatDay(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatConferenceDates(startDate: string, endDate?: string): string {
  if (startDate.toUpperCase().includes("TBD")) return "Dates TBD";
  const start = parseIsoDate(startDate);
  if (!start) return startDate;
  const end = parseIsoDate(endDate);
  if (!end || end.getTime() === start.getTime()) {
    return `${formatDay(start)}, ${start.getUTCFullYear()}`;
  }
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }
  return `${formatDay(start)} – ${formatDay(end)}, ${end.getUTCFullYear()}`;
}

export function formatCheckedAgo(iso?: string, now = Date.now()): string {
  if (!iso) return "Never checked";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "Never checked";
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "Checked today";
  if (days === 1) return "Checked 1 day ago";
  return `Checked ${days} days ago`;
}

export function formatCheckedExact(iso?: string): string {
  if (!iso) return "Never checked";
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function formatDetectedAt(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type ChangeBadgeTone = "amber" | "red" | "slate";

export function changeBadge(change: ConferenceChangeRecord): {
  label: string;
  tone: ChangeBadgeTone;
  dismissible: boolean;
} {
  switch (change.changeType) {
    case "dates":
    case "dates-announced":
      return { label: "📅 DATES UPDATED", tone: "amber", dismissible: true };
    case "location":
      return { label: "📍 LOCATION CHANGED", tone: "amber", dismissible: true };
    case "cancelled":
      return { label: "❌ CANCELLED", tone: "red", dismissible: false };
    case "deadline":
      return { label: "⚠️ DEADLINE UPDATED", tone: "amber", dismissible: true };
    case "venue":
      return { label: "🏛️ VENUE CHANGED", tone: "slate", dismissible: true };
    default:
      return { label: `ℹ️ ${change.changeType.toUpperCase()}`, tone: "slate", dismissible: true };
  }
}

export function changeTypeTitle(changeType: ConferenceChangeType): string {
  switch (changeType) {
    case "dates":
    case "dates-announced":
      return "Dates";
    case "location":
      return "Location";
    case "venue":
      return "Venue";
    case "deadline":
      return "Deadline";
    case "cancelled":
      return "Status";
    default:
      return "Info";
  }
}

export type ConferenceSortKey =
  | "name"
  | "dates"
  | "location"
  | "venue"
  | "registrationFee"
  | "boothFee"
  | "status";

function sortText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function dateSortValue(iso?: string | null): number {
  if (!iso || /tbd/i.test(iso)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function feeSortValue(value?: string | null): string {
  const t = sortText(value);
  if (!t || t === "—" || t.startsWith("tbd")) return "\uffff";
  return t;
}

export function compareConferences(
  a: Conference,
  b: Conference,
  key: ConferenceSortKey,
): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case "dates":
      return dateSortValue(a.startDate) - dateSortValue(b.startDate) || a.name.localeCompare(b.name);
    case "location":
      return sortText(a.location).localeCompare(sortText(b.location)) || a.name.localeCompare(b.name);
    case "venue":
      return sortText(a.venue).localeCompare(sortText(b.venue)) || a.name.localeCompare(b.name);
    case "registrationFee":
      return feeSortValue(a.registrationFee).localeCompare(feeSortValue(b.registrationFee), undefined, {
        numeric: true,
      });
    case "boothFee":
      return feeSortValue(a.boothFee).localeCompare(feeSortValue(b.boothFee), undefined, { numeric: true });
    case "status": {
      const aCancelled = a.isCancelled ? 1 : 0;
      const bCancelled = b.isCancelled ? 1 : 0;
      return aCancelled - bCancelled || dateSortValue(a.lastChecked) - dateSortValue(b.lastChecked);
    }
    default:
      return 0;
  }
}

export type ConferencePriorityFilter = "all" | ConferencePriority;

export const CONFERENCE_PRIORITY_ORDER: readonly ConferencePriority[] = ["green", "amber", "red"];

export function conferencePriorityLabel(priority: ConferencePriority): string {
  switch (priority) {
    case "green":
      return "Green — going";
    case "amber":
      return "Amber — maybe";
    case "red":
      return "Red — not attending";
  }
}

export function conferencePriorityCounts(conferences: Conference[]): Record<ConferencePriorityFilter, number> {
  const counts: Record<ConferencePriorityFilter, number> = {
    all: conferences.length,
    red: 0,
    amber: 0,
    green: 0,
  };
  for (const conf of conferences) {
    counts[priorityOf(conf)] += 1;
  }
  return counts;
}

export function filterConferencesByPriority(
  conferences: Conference[],
  filter: ConferencePriorityFilter,
): Conference[] {
  if (filter === "all") return conferences;
  return conferences.filter((conf) => priorityOf(conf) === filter);
}

export function groupConferencesByPriority(conferences: Conference[]): Array<{
  priority: ConferencePriority;
  items: Conference[];
}> {
  return CONFERENCE_PRIORITY_ORDER.map((priority) => ({
    priority,
    items: conferences.filter((conf) => priorityOf(conf) === priority),
  })).filter((group) => group.items.length > 0);
}
