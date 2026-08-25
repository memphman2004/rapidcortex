import type {
  Conference,
  ConferenceChangeConfidence,
  ConferenceChangeRecord,
  ExtractedConferenceData,
} from "./conference-schemas.js";
import {
  conferenceSourceUrl,
  isReliableConferenceConfidence,
} from "./conference-schemas.js";

function newChangeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `chg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDate(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizePlace(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function formatDateRange(start: string, end?: string | null): string {
  const s = normalizeDate(start);
  const e = normalizeDate(end);
  return e && e !== s ? `${s} – ${e}` : s;
}

function parseDateRange(value: string): { startDate: string; endDate?: string } {
  const parts = value.split(/\s+[–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { startDate: parts[0]!, endDate: parts[1] };
  return { startDate: value.trim() };
}

export function detectConferenceChanges(
  stored: Conference,
  extracted: ExtractedConferenceData,
  opts?: { now?: string; sourceUrl?: string; id?: () => string },
): ConferenceChangeRecord[] {
  if (!isReliableConferenceConfidence(extracted.confidence)) {
    return [];
  }

  const changes: ConferenceChangeRecord[] = [];
  const now = opts?.now ?? new Date().toISOString();
  const sourceUrl = opts?.sourceUrl || conferenceSourceUrl(stored);
  const id = opts?.id ?? newChangeId;
  const confidence: ConferenceChangeConfidence = extracted.confidence;

  const push = (
    changeType: ConferenceChangeRecord["changeType"],
    previousValue: string,
    newValue: string,
  ) => {
    changes.push({
      changeId: id(),
      detectedAt: now,
      changeType,
      previousValue,
      newValue,
      sourceUrl,
      confidence,
      status: "pending",
    });
  };

  const extractedStart = normalizeDate(extracted.startDate);
  const storedStart = normalizeDate(stored.startDate);
  const datesWereTbd = storedStart.toUpperCase().includes("TBD");

  if (extractedStart && datesWereTbd) {
    push("dates-announced", "TBD", formatDateRange(extractedStart, extracted.endDate));
  } else if (extractedStart && extractedStart !== storedStart) {
    push(
      "dates",
      formatDateRange(stored.startDate, stored.endDate),
      formatDateRange(extractedStart, extracted.endDate),
    );
  }

  const extractedLocation = normalizePlace(extracted.location);
  const storedLocation = normalizePlace(stored.location);
  if (extractedLocation && extractedLocation.toLowerCase() !== storedLocation.toLowerCase()) {
    push("location", stored.location, extractedLocation);
  }

  const extractedVenue = normalizePlace(extracted.venue);
  const storedVenue = normalizePlace(stored.venue);
  if (extractedVenue && storedVenue && extractedVenue.toLowerCase() !== storedVenue.toLowerCase()) {
    push("venue", storedVenue, extractedVenue);
  }

  const extractedDeadline = normalizeDate(extracted.registrationDeadline);
  const storedDeadline = normalizeDate(stored.registrationDeadline);
  if (extractedDeadline && extractedDeadline !== storedDeadline) {
    push("deadline", stored.registrationDeadline ?? "unknown", extractedDeadline);
  }

  if (extracted.isCancelled && !stored.isCancelled) {
    push("cancelled", "active", "cancelled");
  }

  return changes;
}

export function applyConferenceChange(
  conf: Conference,
  change: ConferenceChangeRecord,
): Conference {
  const next: Conference = { ...conf, updatedAt: new Date().toISOString() };

  switch (change.changeType) {
    case "dates":
    case "dates-announced": {
      const parsed = parseDateRange(change.newValue);
      next.startDate = parsed.startDate;
      if (parsed.endDate) next.endDate = parsed.endDate;
      break;
    }
    case "location":
      next.location = change.newValue;
      break;
    case "venue":
      next.venue = change.newValue;
      break;
    case "deadline":
      next.registrationDeadline = change.newValue;
      break;
    case "cancelled":
      next.isCancelled = true;
      break;
    default:
      break;
  }

  next.lastChangeType = change.changeType;
  next.lastUpdated = next.updatedAt;
  next.changeHistory = (conf.changeHistory ?? []).map((c) =>
    c.changeId === change.changeId ? { ...c, status: "applied" as const } : c,
  );
  return next;
}

export function dismissConferenceChange(
  conf: Conference,
  changeId: string,
): Conference {
  return {
    ...conf,
    updatedAt: new Date().toISOString(),
    changeHistory: (conf.changeHistory ?? []).map((c) =>
      c.changeId === changeId ? { ...c, status: "dismissed" as const } : c,
    ),
  };
}
