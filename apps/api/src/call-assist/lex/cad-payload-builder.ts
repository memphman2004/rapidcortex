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
    location:
      slots.location ??
      slots.building ??
      slots.section ??
      slots.NoiseLocation ??
      slots.SuspiciousLocation ??
      slots.VehicleLocation ??
      slots.ParkingLocation ??
      slots.TheftLocation ??
      slots.WelfareCheckAddress ??
      slots.AnimalLocation ??
      slots.AccidentLocation ??
      slots.VandalismLocation ??
      slots.CodeEnforcementAddress ??
      slots.PublicWorksLocation ??
      slots.BurglaryVehicleLocation ??
      slots.TowLocation ??
      null,
    crossStreets: slots.crossStreets ?? slots.PersonDirection ?? null,
    aptBusiness: slots.aptBusiness ?? null,
    callerName: slots.callerName ?? null,
    callbackNumber:
      slots.callbackNumber ??
      slots.CallbackNumber ??
      slots.TheftCallbackNumber ??
      slots.TowCallbackNumber ??
      slots.WelfareCheckCallerCallback ??
      slots.AccidentCallbackNumber ??
      null,
    vehicleDesc: buildVehicleDesc(slots),
    licensePlate: slots.licensePlate ?? null,
    suspectDesc: slots.suspectDesc ?? slots.PersonDescription ?? slots.TheftSuspectInfo ?? slots.VandalismSuspectInfo ?? null,
    weaponsPresent: toBoolean(slots.weapons) || toBoolean(slots.WeaponVisible),
    injuriesPresent:
      toBoolean(slots.injuries) || toBoolean(slots.medicalNeeded) || toBoolean(slots.AccidentInjuries),
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
