/** Aggregated usage tallies for overage computation. */
export type UsageTotals = {
  incidentCount: number;
  apiCallCount: number;
  aiSummaryCount: number;
  transcriptionMinutes: number;
  translationMinutes: number;
  mediaSessionCount: number;
  cadExportCount: number;
  webhookDeliveryCount: number;
  storageGb: number;
};

/** Included quotas from plan (+ optional negotiated overrides). */
export type IncludedQuotas = {
  incidents: number | null;
  apiCalls: number | null;
  aiSummaries: number | null;
  transcriptionMinutes: number | null;
  translationMinutes: number | null;
  mediaSessions: number | null;
  cadExports: number | null;
  webhookDeliveries: number | null;
};

/** Overage deltas (never negative). */
export type OverageDeltas = {
  incidents: number;
  apiCalls: number;
  aiSummaries: number;
  transcriptionMinutes: number;
  translationMinutes: number;
  mediaSessions: number;
  cadExports: number;
  webhookDeliveries: number;
};

export function calculateOverages(used: UsageTotals, included: IncludedQuotas): OverageDeltas {
  const bump = (u: number, cap: number | null) =>
    cap == null ? 0 : Math.max(0, u - cap);

  return {
    incidents: bump(used.incidentCount, included.incidents),
    apiCalls: bump(used.apiCallCount, included.apiCalls),
    aiSummaries: bump(used.aiSummaryCount, included.aiSummaries),
    transcriptionMinutes: bump(used.transcriptionMinutes, included.transcriptionMinutes),
    translationMinutes: bump(used.translationMinutes, included.translationMinutes),
    mediaSessions: bump(used.mediaSessionCount, included.mediaSessions),
    cadExports: bump(used.cadExportCount, included.cadExports),
    webhookDeliveries: bump(used.webhookDeliveryCount, included.webhookDeliveries),
  };
}
