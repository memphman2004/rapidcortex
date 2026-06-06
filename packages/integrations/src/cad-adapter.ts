export type CadCallerCardContext = {
  incidentId: string;
  agencyId: string;
  title: string;
  callerAddressLine?: string | null;
  /** Normalized premise key (aligned with incident `callerAddressNormalized`). */
  normalizedAddress?: string | null;
};

/** Read CAD/RMS context and push summaries back — implementation stays vendor-specific. */
export interface CadAdapter {
  readonly adapterId: string;
  getIncidentContext(externalCadId: string): Promise<Record<string, unknown>>;
  pushSummary(payload: { externalCadId: string; summary: string }): Promise<void>;
  /** Premise / caller enrichment — optional until CAD vendors implement it. */
  getCallerData?(ctx: CadCallerCardContext): Promise<Record<string, unknown>>;
}
