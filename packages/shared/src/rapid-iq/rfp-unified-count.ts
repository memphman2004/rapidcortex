/**
 * Unified RFP predicate across Rapid IQ opportunity feed, pipeline signals,
 * and Opportunity Intelligence rows. Used by the 15-minute snapshot Lambda
 * and the dashboard RFPs tile.
 */

export const RAPID_IQ_RFP_COUNT_VERTICALS = [
  "psap",
  "campus",
  "venue",
  "hospital",
  "transit",
  "unknown",
] as const;
export type RapidIqRfpCountVertical = (typeof RAPID_IQ_RFP_COUNT_VERTICALS)[number];

export const RAPID_IQ_RFP_COUNT_PK = "RFP_COUNTS";
export const RAPID_IQ_RFP_COUNT_SK = "LATEST";

export type RapidIqRfpStatusBucket = {
  new: number;
  reviewed: number;
  inPipeline: number;
  dismissed: number;
  other: number;
};

export type RapidIqRfpVerticalCounts = {
  all: number;
  /** Open solicitations (excludes dismissed). Dashboard tile uses this. */
  open: number;
  psap: number;
  campus: number;
  venue: number;
  hospital: number;
  transit: number;
  unknown: number;
  byStatus: RapidIqRfpStatusBucket;
};

export type RapidIqRfpCountSnapshot = {
  pk: typeof RAPID_IQ_RFP_COUNT_PK;
  sk: typeof RAPID_IQ_RFP_COUNT_SK;
  entityType: "rfp_count";
  updatedAt: string;
  opportunityFeed: RapidIqRfpVerticalCounts;
  pipeline: RapidIqRfpVerticalCounts;
  intel: RapidIqRfpVerticalCounts;
  total: RapidIqRfpVerticalCounts;
};

const INTEL_RFP_TYPES = new Set(["RFP", "RFQ", "RFB", "PROCUREMENT_NOTICE"]);

function tagHay(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string").map((t) => t.toUpperCase());
}

/** Map feed / pipeline / intel market labels onto dashboard verticals. */
export function normalizeRfpCountVertical(raw: unknown): RapidIqRfpCountVertical {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "");
  if (v === "911" || v === "psap" || v === "rc911" || v === "core") return "psap";
  if (v === "campus") return "campus";
  if (v === "venue") return "venue";
  if (v === "hospital") return "hospital";
  if (v === "transit") return "transit";
  return "unknown";
}

export function emptyRfpVerticalCounts(): RapidIqRfpVerticalCounts {
  return {
    all: 0,
    open: 0,
    psap: 0,
    campus: 0,
    venue: 0,
    hospital: 0,
    transit: 0,
    unknown: 0,
    byStatus: { new: 0, reviewed: 0, inPipeline: 0, dismissed: 0, other: 0 },
  };
}

export function emptyRfpCountSnapshot(updatedAt = new Date().toISOString()): RapidIqRfpCountSnapshot {
  return {
    pk: RAPID_IQ_RFP_COUNT_PK,
    sk: RAPID_IQ_RFP_COUNT_SK,
    entityType: "rfp_count",
    updatedAt,
    opportunityFeed: emptyRfpVerticalCounts(),
    pipeline: emptyRfpVerticalCounts(),
    intel: emptyRfpVerticalCounts(),
    total: emptyRfpVerticalCounts(),
  };
}

/**
 * Unified RFP / open-solicitation predicate.
 * Intel rows are RFPs when typed as a solicitation (or stage ≥ 8 / PRE_RFP_SIGNAL),
 * not merely “relevant above fit floor” (that would count board agendas).
 */
export function isUnifiedRfpRecord(item: Record<string, unknown>): boolean {
  const tags = tagHay(item.tags);
  if (tags.some((t) => t === "RFP LIVE" || t === "ACTIVE_RFP" || t === "RFP")) return true;
  if (item.intentStage === "active_rfp") return true;
  if (String(item.signalType ?? "").toLowerCase() === "rfp") return true;
  if (item.procurementStage === "rfp") return true;

  const stageNum =
    typeof item.procurementStage === "number"
      ? item.procurementStage
      : Number.parseInt(String(item.userProcurementStage ?? ""), 10);
  if (Number.isFinite(stageNum) && stageNum >= 8) return true;

  const ot = String(item.opportunityType ?? "").toUpperCase();
  if (INTEL_RFP_TYPES.has(ot)) return true;
  if (ot === "PRE_RFP_SIGNAL" && item.preRfpSignal === true) return true;

  return false;
}

export function isRfpCountIndexRow(item: Record<string, unknown>): boolean {
  const pk = String(item.pk ?? "");
  if (!pk) return Boolean(item.opportunityId);
  if (pk.startsWith("SIGNAL#") || pk.startsWith("INTEL#")) return true;
  if (item.opportunityId && item.agencyName) return true;
  return false;
}

export function accumulateRfpCount(
  counts: RapidIqRfpVerticalCounts,
  item: Record<string, unknown>,
): void {
  counts.all += 1;
  const vertical = normalizeRfpCountVertical(item.vertical ?? item.market);
  counts[vertical] += 1;

  const status = String(item.status ?? "new").toLowerCase();
  if (status === "new") counts.byStatus.new += 1;
  else if (status === "reviewed" || status === "watching" || status === "qualified") {
    counts.byStatus.reviewed += 1;
  } else if (
    status === "pushed" ||
    status === "pursuing" ||
    status === "added_to_pipeline" ||
    item.isInPipeline === true
  ) {
    counts.byStatus.inPipeline += 1;
  } else if (status === "dismissed" || status === "passed" || status === "converted") {
    counts.byStatus.dismissed += 1;
  } else {
    counts.byStatus.other += 1;
  }
  counts.open = counts.all - counts.byStatus.dismissed;
}

export function sumRfpVerticalCounts(
  a: RapidIqRfpVerticalCounts,
  b: RapidIqRfpVerticalCounts,
  c: RapidIqRfpVerticalCounts,
): RapidIqRfpVerticalCounts {
  const total = emptyRfpVerticalCounts();
  for (const key of ["all", "open", "psap", "campus", "venue", "hospital", "transit", "unknown"] as const) {
    total[key] = a[key] + b[key] + c[key];
  }
  total.byStatus.new = a.byStatus.new + b.byStatus.new + c.byStatus.new;
  total.byStatus.reviewed = a.byStatus.reviewed + b.byStatus.reviewed + c.byStatus.reviewed;
  total.byStatus.inPipeline = a.byStatus.inPipeline + b.byStatus.inPipeline + c.byStatus.inPipeline;
  total.byStatus.dismissed = a.byStatus.dismissed + b.byStatus.dismissed + c.byStatus.dismissed;
  total.byStatus.other = a.byStatus.other + b.byStatus.other + c.byStatus.other;
  total.open = total.all - total.byStatus.dismissed;
  return total;
}
