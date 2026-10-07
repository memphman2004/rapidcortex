/**
 * Map canonical WatchSignal → Rapid IQ pipeline watch-ingest body + enrichments.
 */

import type { RapidIqWatchIngestBody } from "./pipeline-schemas.js";
import type { WatchSignal } from "./watch-signal-schema.js";
import { computeWatchPriorityScore } from "./watch-ingest-utils.js";

function mapWatchName(watch: WatchSignal["watch"]): string {
  return watch;
}

function mapVertical(primary: WatchSignal["primary_vertical"]): RapidIqWatchIngestBody["vertical"] {
  switch (primary) {
    case "campus":
      return "campus";
    case "venue":
      return "venue";
    case "transit":
      return "transit";
    case "competitor":
      return "competitors";
    case "law_enforcement":
    case "rtcc":
      return "law_enforcement";
    case "psap":
    case "cross_vertical":
    default:
      return "911_psap";
  }
}

function mapSignalType(type: WatchSignal["signal"]["type"]): RapidIqWatchIngestBody["signal_type"] {
  switch (type) {
    case "procurement":
      return "rfp";
    case "planning":
      return "planning";
    case "funded":
      return "funded";
    case "competitor_activity":
      return "competitor";
    default:
      return "early_signal";
  }
}

function mapEvidenceSourceType(
  quality: WatchSignal["evidence"][number]["source_quality"],
  sourceType: string,
): NonNullable<RapidIqWatchIngestBody["evidence"]>[number]["source_type"] {
  const t = sourceType.toLowerCase();
  if (t.includes("procurement") || t.includes("rfp") || t.includes("solicitation")) {
    return "official_procurement";
  }
  if (t.includes("agenda") || t.includes("minutes") || t.includes("board")) return "board_agenda";
  if (t.includes("budget") || t.includes("cip")) return "budget";
  if (t.includes("grant")) return "grant";
  if (t.includes("news")) return "news";
  if (quality === "authoritative") return "official_procurement";
  return "other";
}

function mapLifecycle(
  change: WatchSignal["lifecycle"]["change_type"],
): NonNullable<RapidIqWatchIngestBody["lifecycle"]>["change_type"] {
  switch (change) {
    case "new":
    case "deadline_change":
    case "addendum":
    case "qa":
    case "cancel":
    case "award":
    case "contact_change":
    case "budget_change":
    case "scope_change":
    case "none":
      return change;
    case "vendor_demo":
    case "vendor_selected":
    case "contract_renewal":
    case "implementation":
      return "status_change";
    default:
      return "none";
  }
}

function mapOpportunityStatus(
  status: string | null,
): NonNullable<RapidIqWatchIngestBody["opportunity"]["status"]> {
  const s = (status ?? "").toLowerCase();
  if (s === "open" || s === "updated" || s === "cancelled" || s === "awarded" || s === "unknown") {
    return s;
  }
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("award")) return "awarded";
  if (s.includes("update")) return "updated";
  if (!s) return "unknown";
  return "open";
}

/** Fallback procurement URL when Watch sends null — evidence[0].url is required by schema. */
function resolveProcurementUrl(signal: WatchSignal): string {
  if (signal.opportunity.procurement_url?.trim()) return signal.opportunity.procurement_url.trim();
  return signal.evidence[0]!.url;
}

export function watchSignalToPipelineIngest(signal: WatchSignal): {
  body: RapidIqWatchIngestBody;
  enrichments: {
    facts: string[];
    inferences: string[];
    competitors: string[];
    technologies: string[];
    matchedCapabilities: string[];
    painPoints: string[];
    buyingStage: WatchSignal["signal"]["buying_stage"];
    signalStrength: WatchSignal["signal"]["strength"];
    buyingSignalType: WatchSignal["signal"]["type"];
    signalCategory: string;
    primaryVertical: string;
    verticals: string[];
    priorityScore: number;
    priorityLabel: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
    department: string | null;
  };
} {
  const procurementUrl = resolveProcurementUrl(signal);
  const fundingIdentified = Boolean(
    signal.funding.estimated_contract_value != null ||
      signal.funding.project_budget != null ||
      signal.funding.grant_amount != null ||
      signal.funding.annual_support != null,
  );
  const hasAuthoritativeEvidence = signal.evidence.some((e) => e.source_quality === "authoritative");
  const { priority_score, priority_label } = computeWatchPriorityScore({
    fit: signal.qualification.fit,
    strength: signal.signal.strength,
    buyingStage: signal.signal.buying_stage,
    dueDate: signal.opportunity.due_date,
    fundingIdentified,
    hasAuthoritativeEvidence,
    lifecycleChange: signal.lifecycle.change_type,
    hasPainPoints: signal.pain_points.length > 0,
    matchedCapabilityCount: signal.matched_capabilities.length,
  });

  const primaryContact = signal.contacts.find((c) => c.name?.trim()) ?? signal.contacts[0];

  const body: RapidIqWatchIngestBody = {
    source: "chatgpt_watch",
    watch: mapWatchName(signal.watch),
    external_key: signal.external_key,
    signal_type: mapSignalType(signal.signal.type),
    vertical: mapVertical(signal.primary_vertical),
    agency: {
      name: signal.agency.name,
      city: signal.agency.city,
      state: (() => {
        const s = signal.agency.state?.trim();
        if (s && s.length >= 2) return s.slice(0, 2).toUpperCase();
        return "XX";
      })(),
    },
    opportunity: {
      title: signal.signal.title,
      solicitation_number: signal.opportunity.solicitation_number,
      posted_date: signal.opportunity.posted_date ?? signal.signal.event_date,
      due_date: signal.opportunity.due_date,
      estimated_value: signal.funding.estimated_contract_value,
      estimated_contract_value: signal.funding.estimated_contract_value,
      project_budget: signal.funding.project_budget,
      funding_amount: signal.funding.grant_amount,
      annual_recurring_budget: signal.funding.annual_support,
      funding_source: signal.funding.funding_source,
      funding_notes: null,
      procurement_url: procurementUrl,
      status: mapOpportunityStatus(signal.opportunity.status),
    },
    contact: primaryContact
      ? {
          name: primaryContact.name,
          title: primaryContact.title,
          email: primaryContact.email ?? null,
          phone: primaryContact.phone,
        }
      : undefined,
    qualification: {
      fit: signal.qualification.fit,
      strategy: signal.qualification.strategy,
      reason: signal.qualification.reason,
    },
    next_action: signal.next_action,
    lifecycle: {
      change_type: mapLifecycle(signal.lifecycle.change_type),
      summary: signal.lifecycle.summary,
    },
    evidence: signal.evidence.map((e) => ({
      url: e.url,
      source_type: mapEvidenceSourceType(e.source_quality, e.source_type),
    })),
  };

  return {
    body,
    enrichments: {
      facts: signal.facts,
      inferences: signal.inferences,
      competitors: signal.competitors,
      technologies: signal.technologies,
      matchedCapabilities: signal.matched_capabilities,
      painPoints: signal.pain_points,
      buyingStage: signal.signal.buying_stage,
      signalStrength: signal.signal.strength,
      buyingSignalType: signal.signal.type,
      signalCategory: signal.signal.category,
      primaryVertical: signal.primary_vertical,
      verticals: signal.verticals,
      priorityScore: priority_score,
      priorityLabel: priority_label,
      department: signal.agency.department,
    },
  };
}

export function isCanonicalWatchSignal(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === "chatgpt_watch" &&
    typeof v.signal === "object" &&
    v.signal != null &&
    typeof v.funding === "object" &&
    Array.isArray(v.facts) &&
    Array.isArray(v.evidence)
  );
}
