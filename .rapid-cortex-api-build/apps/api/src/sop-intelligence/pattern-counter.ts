export type SopPatternRecord = {
  PK: string;
  SK: string;
  agencyId: string;
  sopId: string;
  stepId: string;
  sopTitle: string;
  gapCount: number;
  reportIds: string[];
  lastFlagged: string;
  latestGapDescription?: string;
  suggestionGenerated: boolean;
  pendingUpdateId?: string;
};

export function patternSk(sopId: string, stepId: string): string {
  return `PATTERN#${sopId}#${stepId}`;
}

/** Read-then-write counter shape (no Dynamo call). */
export function nextPatternRecord(
  existing: SopPatternRecord | null,
  params: {
    agencyId: string;
    sopId: string;
    stepId: string;
    sopTitle: string;
    reportId: string;
    gapDescription?: string;
  },
  nowIso: string,
): SopPatternRecord {
  if (!existing) {
    return {
      PK: params.agencyId,
      SK: patternSk(params.sopId, params.stepId),
      agencyId: params.agencyId,
      sopId: params.sopId,
      stepId: params.stepId,
      sopTitle: params.sopTitle,
      gapCount: 1,
      reportIds: [params.reportId],
      lastFlagged: nowIso,
      latestGapDescription: params.gapDescription,
      suggestionGenerated: false,
    };
  }
  return {
    ...existing,
    gapCount: existing.gapCount + 1,
    reportIds: [...existing.reportIds, params.reportId].slice(-50),
    lastFlagged: nowIso,
    latestGapDescription: params.gapDescription ?? existing.latestGapDescription,
    sopTitle: params.sopTitle || existing.sopTitle,
  };
}
