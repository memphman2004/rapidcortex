import type { CadAdapter, CadCallerCardContext } from "../cad-adapter.js";

/** Future: OAuth to CAD vendor, map narrative field IDs, respect agency write policies. */
export class CadSummaryPushPlaceholder implements CadAdapter {
  readonly adapterId = "cad-summary-push-placeholder";

  async getIncidentContext(externalCadId: string): Promise<Record<string, unknown>> {
    return { externalCadId, status: "placeholder" };
  }

  async pushSummary(_payload: { externalCadId: string; summary: string }): Promise<void> {
    /* no-op */
  }

  async getCallerData(ctx: CadCallerCardContext): Promise<Record<string, unknown>> {
    return { status: "placeholder", incidentId: ctx.incidentId };
  }
}
