import {
  buildCadMappedSopOverlay,
  matchCadNatureMappingFromConfig,
  type CadNatureCodeMapping,
  type Incident,
  type IncidentCategory,
  type SopProtocolOverlayState,
} from "rapid-cortex-shared";
import type { NormalizedCadIncident } from "./types.js";

export type CadIngestIntelligence = {
  mapping: CadNatureCodeMapping | null;
  title: string;
  category?: IncidentCategory;
  escalationFlag?: boolean;
  mappedTypeId: string | null;
  sopOverlay: SopProtocolOverlayState | null;
};

export function resolveCadIngestIntelligence(args: {
  normalized: NormalizedCadIncident;
  config: Record<string, unknown> | undefined;
  existing: Incident | null;
  now: string;
  mappingEnabled: boolean;
}): CadIngestIntelligence {
  const mapping = args.mappingEnabled
    ? matchCadNatureMappingFromConfig(args.config, args.normalized.incidentType)
    : null;
  const title =
    mapping?.rcIncidentTypeLabel?.trim() ||
    args.normalized.incidentType ||
    args.existing?.title ||
    `CAD ${args.normalized.cadNumber}`;
  const sopOverlay = args.mappingEnabled
    ? buildCadMappedSopOverlay({
        mapping,
        existing: args.existing?.sopProtocolOverlay,
        now: args.now,
      })
    : null;
  return {
    mapping,
    title,
    category: mapping?.rcIncidentCategory,
    escalationFlag: mapping?.supervisorAlert ? true : undefined,
    mappedTypeId: mapping?.rcIncidentTypeId ?? null,
    sopOverlay,
  };
}

export function mergeCadExtras(
  n: NormalizedCadIncident,
  existing: Incident | null,
): Pick<
  Incident,
  | "cadPriorityModifier"
  | "cadDisposition"
  | "cadIntersection"
  | "cadBeat"
  | "cadZone"
  | "cadJurisdiction"
  | "cadLocationConfidence"
  | "cadLocationSource"
  | "cadCallerAddressLine"
  | "cadAniAliSource"
  | "cadRelatedCadNumbers"
  | "cadDuplicateOfCadNumber"
  | "cadUnitDetails"
  | "cadAlerts"
> {
  return {
    cadPriorityModifier: n.priorityModifier ?? existing?.cadPriorityModifier ?? null,
    cadDisposition: n.disposition ?? existing?.cadDisposition ?? null,
    cadIntersection: n.intersection ?? existing?.cadIntersection ?? null,
    cadBeat: n.beat ?? existing?.cadBeat ?? null,
    cadZone: n.zone ?? existing?.cadZone ?? null,
    cadJurisdiction: n.jurisdiction ?? existing?.cadJurisdiction ?? null,
    cadLocationConfidence: n.locationConfidence ?? existing?.cadLocationConfidence ?? null,
    cadLocationSource: n.locationSource ?? existing?.cadLocationSource ?? null,
    cadCallerAddressLine: n.callerAddress ?? existing?.cadCallerAddressLine ?? null,
    cadAniAliSource: n.aniAliSource ?? existing?.cadAniAliSource ?? null,
    cadRelatedCadNumbers: n.relatedCadNumbers?.length
      ? n.relatedCadNumbers
      : existing?.cadRelatedCadNumbers ?? [],
    cadDuplicateOfCadNumber: n.duplicateOfCadNumber ?? existing?.cadDuplicateOfCadNumber ?? null,
    cadUnitDetails: n.unitDetails?.length ? n.unitDetails : existing?.cadUnitDetails ?? [],
    cadAlerts: n.alerts?.length ? n.alerts : existing?.cadAlerts ?? [],
  };
}
