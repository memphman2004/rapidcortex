import type { Incident } from "rapid-cortex-shared";

export function buildClusterSummary(params: {
  incidentIds: string[];
  headlineKeywords: string[];
  windowMinutes: number;
  anchorIncident?: Incident | null;
}): string {
  const n = params.incidentIds.length;
  const loc =
    params.anchorIncident?.callerAddressLine?.trim() ||
    params.anchorIncident?.cadLocation?.trim() ||
    "nearby area";
  const kw = params.headlineKeywords.slice(0, 8).join(", ") || "shared incident language";
  return `${n} calls in ~${params.windowMinutes} min near “${loc}”. Overlap: ${kw}.`;
}
