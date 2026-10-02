/**
 * [CR-2][CR-4] Read-path normalization for SalesLeads CRM records.
 * Does not mutate DynamoDB — callers use migrate script for durable backfill.
 */
import {
  CHANNEL_CONFIG,
  legacyStatusToStage,
  type LeadActivity,
  type LeadAttribution,
  type LeadChannel,
  type LeadNote,
  type PipelineStage,
  type SalesLeadCrmRecord,
} from "rapid-cortex-shared";

function asRecord(item: unknown): Record<string, unknown> {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

function sourceToChannel(source: string | undefined): LeadChannel {
  const s = (source ?? "").toLowerCase();
  if (s.includes("ring")) return "ring_waitlist";
  if (s.includes("contact") || s === "contact-sales" || s.includes("demo")) return "contact_sales";
  if (s.includes("cortex") || s.includes("inside")) return "inside_the_cortex";
  if (s === "linkedin") return "linkedin";
  if (s === "google" || s === "organic_search") return "organic_search";
  if (s === "direct") return "direct";
  if (s === "referral" || s === "twitter") return "referral";
  return "other";
}

export function normalizeLead(item: Record<string, unknown> | SalesLeadCrmRecord): SalesLeadCrmRecord {
  const raw = asRecord(item);
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  const source = typeof raw.source === "string" ? raw.source : undefined;

  let pipelineStage: PipelineStage = legacyStatusToStage(
    typeof raw.status === "string" ? raw.status : "new",
  );
  const rawStage = String(raw.pipelineStage ?? "").toUpperCase();
  if (
    rawStage === "NEW" ||
    rawStage === "CONTACTED" ||
    rawStage === "QUALIFIED" ||
    rawStage === "DISCOVERY" ||
    rawStage === "PROPOSAL" ||
    rawStage === "NEGOTIATION" ||
    rawStage === "PILOT" ||
    rawStage === "WON" ||
    rawStage === "LOST"
  ) {
    pipelineStage = rawStage as PipelineStage;
  }

  let notes: LeadNote[];
  if (typeof raw.notes === "string" && raw.notes.trim()) {
    notes = [
      {
        noteId: "legacy-note",
        text: raw.notes.trim(),
        authorId: "system",
        authorName: "Imported",
        createdAt,
        pinned: false,
      },
    ];
  } else if (Array.isArray(raw.notes)) {
    notes = raw.notes as LeadNote[];
  } else {
    notes = [];
  }

  let activities: LeadActivity[];
  if (Array.isArray(raw.activities) && raw.activities.length > 0) {
    activities = raw.activities as LeadActivity[];
  } else {
    activities = [
      {
        activityId: "created-event",
        type: "created",
        description: `Lead created · Source: ${source ?? "unknown"}`,
        createdAt,
      },
    ];
  }

  let attribution: LeadAttribution | undefined =
    raw.attribution && typeof raw.attribution === "object"
      ? (raw.attribution as LeadAttribution)
      : undefined;
  if (!attribution) {
    const channel = sourceToChannel(source);
    attribution = {
      channel,
      channelLabel: CHANNEL_CONFIG[channel].label,
      firstTouchAt: createdAt,
      ipRegion:
        typeof raw.requestedState === "string"
          ? raw.requestedState
          : typeof raw.state === "string"
            ? raw.state
            : null,
    };
  }

  const email = String(raw.email ?? "");
  const firstName = typeof raw.firstName === "string" ? raw.firstName : undefined;
  const lastName = typeof raw.lastName === "string" ? raw.lastName : undefined;
  const nameFromParts = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    ...(raw as SalesLeadCrmRecord),
    leadId: String(raw.leadId ?? ""),
    email,
    createdAt,
    source,
    status: typeof raw.status === "string" ? raw.status : "new",
    packageSold: typeof raw.packageSold === "string" ? raw.packageSold : "none",
    pipelineStage,
    notes,
    activities,
    attribution,
    firstName,
    lastName,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name
        : nameFromParts || undefined,
    agencyName:
      typeof raw.agencyName === "string"
        ? raw.agencyName
        : typeof raw.agencyCompany === "string"
          ? raw.agencyCompany
          : undefined,
    assignedTo:
      typeof raw.assignedTo === "string"
        ? raw.assignedTo
        : typeof raw.assignee === "string"
          ? raw.assignee
          : undefined,
  };
}

export function parseDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobi|iphone|android/.test(u)) return "mobile";
  return "desktop";
}
