import type { CallTriageClassification } from "./classifications.js";
import type { CallIntakeData } from "./intake.js";
import type { AgencyTaxonomy } from "./taxonomy.js";
import { findCallType } from "./taxonomy.js";

export type IntakeQuestion = {
  id: string;
  prompt: string;
  field: keyof CallIntakeData | "freeform";
};

const ALWAYS_LOCATION: IntakeQuestion = {
  id: "location",
  prompt: "What is the address or closest intersection?",
  field: "locationText",
};

const CALLBACK: IntakeQuestion = {
  id: "callback",
  prompt: "What number can we call you back on?",
  field: "callbackNumber",
};

const IN_PROGRESS: IntakeQuestion = {
  id: "in_progress",
  prompt: "Is this happening right now, or did it already happen?",
  field: "isInProgress",
};

const VEHICLE: IntakeQuestion = {
  id: "vehicle",
  prompt: "Do you have the vehicle make, color, or license plate?",
  field: "vehicleMake",
};

const SUSPECT: IntakeQuestion = {
  id: "suspect",
  prompt: "Can you describe the person involved?",
  field: "suspectDescription",
};

const BY_CLASS: Partial<Record<string, IntakeQuestion[]>> = {
  NOISE_COMPLAINT: [ALWAYS_LOCATION, IN_PROGRESS, CALLBACK],
  PARKING: [ALWAYS_LOCATION, VEHICLE, CALLBACK],
  TOW_COMPLAINT: [ALWAYS_LOCATION, VEHICLE, CALLBACK],
  ANIMAL_CONTROL: [ALWAYS_LOCATION, IN_PROGRESS, CALLBACK],
  CODE_ENFORCEMENT: [ALWAYS_LOCATION, CALLBACK],
  PUBLIC_WORKS: [ALWAYS_LOCATION, CALLBACK],
  REPORT_ONLY: [ALWAYS_LOCATION, IN_PROGRESS, VEHICLE, CALLBACK],
  CARFAX_REPORTING_ELIGIBLE: [ALWAYS_LOCATION, VEHICLE, IN_PROGRESS, CALLBACK],
  ONLINE_REPORTING_ELIGIBLE: [ALWAYS_LOCATION, CALLBACK],
  NON_EMERGENCY_POLICE: [ALWAYS_LOCATION, IN_PROGRESS, SUSPECT, VEHICLE, CALLBACK],
  INFORMATION_REQUEST: [CALLBACK],
  UNKNOWN: [ALWAYS_LOCATION, IN_PROGRESS, CALLBACK],
};

function isFilled(intake: CallIntakeData, field: IntakeQuestion["field"]): boolean {
  if (field === "freeform") return false;
  const value = intake[field];
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return Boolean(value && String(value).trim());
}

const TEMPLATE_FIELD_TO_INTAKE: Record<string, IntakeQuestion["field"]> = {
  location: "locationText",
  building: "locationText",
  section: "locationText",
  callbackNumber: "callbackNumber",
  callerName: "callerName",
  injuries: "injuries",
  medicalNeeded: "injuries",
  vehicleMake: "vehicleMake",
  licensePlate: "vehiclePlate",
  suspectDesc: "suspectDescription",
  preferredLang: "language",
  incidentType: "incidentTypeHint",
  concernType: "incidentTypeHint",
  reportType: "incidentTypeHint",
  description: "summary",
  guestContact: "callbackNumber",
};

/**
 * Next unanswered intake prompt. Emergency classification must never request more AI questions.
 */
export function nextIntakeQuestion(
  classification: CallTriageClassification,
  intake: CallIntakeData,
  taxonomy?: AgencyTaxonomy | null,
): IntakeQuestion | null {
  const matched = taxonomy ? findCallType(taxonomy, classification) : undefined;
  if (classification === "EMERGENCY" || classification === "emergency" || matched?.isEmergency) return null;

  if (taxonomy && matched) {
    for (const q of matched.followUpQuestions) {
      const field = TEMPLATE_FIELD_TO_INTAKE[q.fieldId] ?? "freeform";
      if (q.condition) {
        const condField = TEMPLATE_FIELD_TO_INTAKE[q.condition.fieldId];
        if (condField && condField !== "freeform") {
          const current = String(intake[condField] ?? "");
          if (current !== q.condition.value) continue;
        }
      }
      if (!isFilled(intake, field)) {
        return { id: q.id, prompt: q.prompt, field };
      }
    }
    const template = taxonomy.intakeTemplates.find((t) => t.id === matched.intakeTemplateId);
    for (const f of template?.fields ?? []) {
      if (!f.required) continue;
      const field = TEMPLATE_FIELD_TO_INTAKE[f.id];
      if (!field || field === "freeform") continue;
      if (!isFilled(intake, field)) {
        return { id: f.id, prompt: f.helpText || `${f.label}?`, field };
      }
    }
  }

  const queue = BY_CLASS[classification] ?? BY_CLASS.UNKNOWN ?? [];
  return queue.find((q) => !isFilled(intake, q.field)) ?? null;
}
