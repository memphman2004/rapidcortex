import { findCallTypeForIntent } from "./intent-classifier.js";
import type { CallAssistTenantConfig } from "../store.js";
import { resolveAgencyTaxonomy } from "rapid-cortex-shared";

export type CadPayload = {
  agencyId: string;
  natureCode: string | null;
  priority: number;
  location: string | null;
  crossStreets: string | null;
  aptBusiness: string | null;
  callerName: string | null;
  callbackNumber: string | null;
  vehicleDesc: string | null;
  licensePlate: string | null;
  suspectDesc: string | null;
  weaponsPresent: boolean;
  injuriesPresent: boolean;
  notes: string;
  aiGenerated: true;
  requiresHumanReview: true;
};

/** Structured record only. Does not push to CAD (ENABLE_CALL_ASSIST_CAD_PUSH stays false). */
export function buildCadPayload(
  agencyId: string,
  callTypeId: string,
  slots: Record<string, string | null>,
  config: CallAssistTenantConfig,
): CadPayload {
  const taxonomy = resolveAgencyTaxonomy(config);
  const callType =
    findCallTypeForIntent(taxonomy, callTypeId) ?? taxonomy.callTypes.find((t) => t.id === callTypeId);
  return {
    agencyId,
    natureCode: callType?.cadNatureCode ?? config.cadNatureMapping[callTypeId] ?? null,
    priority: callType?.defaultPriority ?? 3,
    location: slots.location ?? slots.building ?? slots.section ?? null,
    crossStreets: slots.crossStreets ?? null,
    aptBusiness: slots.aptBusiness ?? null,
    callerName: slots.callerName ?? null,
    callbackNumber: slots.callbackNumber ?? null,
    vehicleDesc: buildVehicleDesc(slots),
    licensePlate: slots.licensePlate ?? null,
    suspectDesc: slots.suspectDesc ?? null,
    weaponsPresent: toBoolean(slots.weapons),
    injuriesPresent: toBoolean(slots.injuries) || toBoolean(slots.medicalNeeded),
    notes: buildNotes(slots),
    aiGenerated: true,
    requiresHumanReview: true,
  };
}

function buildVehicleDesc(slots: Record<string, string | null>): string | null {
  const parts = [slots.vehicleColor, slots.vehicleMake, slots.vehicleModel].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function buildNotes(slots: Record<string, string | null>): string {
  return Object.entries(slots)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

function toBoolean(val: string | null | undefined): boolean {
  const s = (val ?? "").toLowerCase();
  return s === "true" || s.startsWith("y") || s === "1";
}
