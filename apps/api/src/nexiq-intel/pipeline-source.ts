import type { IntelligenceSource, RapidIqPipelineSourceId } from "rapid-cortex-shared";

/**
 * Map a NexiQ Intel registry source onto Civic iQ pipeline sourceIds
 * so Signal Feed tabs/labels match the existing Rapid iQ collectors.
 */
export function pipelineSourceIdForIntelSource(
  source: Pick<IntelligenceSource, "url" | "name" | "organization" | "sourceType">,
): RapidIqPipelineSourceId {
  const hay = `${source.url} ${source.name} ${source.organization ?? ""} ${source.sourceType}`.toLowerCase();
  if (/\bfcc(\.gov)?\b/.test(hay)) return "fcc-reports";
  if (hay.includes("civicclerk") || hay.includes("civic clerk")) return "civiclerk";
  if (hay.includes("911.gov") || hay.includes("ng911") || /\b911\.gov\b/.test(hay)) return "911-gov";
  if (hay.includes("sam.gov") || hay.includes("sam-gov")) return "sam-gov";
  if (hay.includes("grants.gov") || hay.includes("grants-gov")) return "grants-gov";
  if (hay.includes("boarddocs")) return "boarddocs";
  return "nexiq-intel";
}
