import type { CallTriageClassification } from "./classifications.js";
import type { CallIntakeData } from "./intake.js";
import type { AgencyTaxonomy, FollowUpQuestion } from "./taxonomy.js";
import { findCallType } from "./taxonomy.js";

export type QuestionPolicy = "ask" | "clarify" | "skip" | "never_repeat";

export type IntakeQuestion = {
  id: string;
  prompt: string;
  promptEs?: string;
  field: keyof CallIntakeData | "freeform";
  policy?: QuestionPolicy;
  required?: boolean;
  clarifyPrompt?: string;
  clarifyPromptEs?: string;
  /** When true, the caller should hear the clarify phrasing this turn. */
  clarify?: boolean;
};

const ALWAYS_LOCATION: IntakeQuestion = {
  id: "location",
  prompt: "What is the address or closest intersection?",
  promptEs: "¿Cuál es la dirección o la intersección más cercana?",
  field: "locationText",
  policy: "ask",
  required: true,
  clarifyPrompt: "I need a street address or intersection if you have one.",
  clarifyPromptEs: "Necesito una dirección o intersección, si la tiene.",
};

const CALLBACK: IntakeQuestion = {
  id: "callback",
  prompt: "What number can we call you back on?",
  promptEs: "¿A qué número podemos devolverle la llamada?",
  field: "callbackNumber",
  policy: "ask",
  required: true,
  clarifyPrompt: "Please give a callback number, even if it is this line.",
  clarifyPromptEs: "Por favor dé un número de devolución, aunque sea esta línea.",
};

const IN_PROGRESS: IntakeQuestion = {
  id: "in_progress",
  prompt: "Is this happening right now, or did it already happen?",
  promptEs: "¿Esto está pasando ahora, o ya ocurrió?",
  field: "isInProgress",
  policy: "clarify",
  required: true,
  clarifyPrompt: "Is this happening right now? Yes or no is enough.",
  clarifyPromptEs: "¿Esto está pasando ahora? Sí o no es suficiente.",
};

const APT: IntakeQuestion = {
  id: "apartment",
  prompt: "Is there an apartment, suite, or unit number?",
  promptEs: "¿Hay número de apartamento, suite o unidad?",
  field: "apartmentSuite",
  policy: "never_repeat",
};

const CROSS: IntakeQuestion = {
  id: "cross_streets",
  prompt: "What are the nearest cross streets?",
  promptEs: "¿Cuáles son las calles transversales más cercanas?",
  field: "crossStreets",
  policy: "never_repeat",
};

const DIRECTION: IntakeQuestion = {
  id: "direction",
  prompt: "Which direction were they traveling, or are they still there?",
  promptEs: "¿En qué dirección iban, o todavía están ahí?",
  field: "directionOfTravel",
  policy: "never_repeat",
};

const VEHICLE: IntakeQuestion = {
  id: "vehicle",
  prompt: "Do you have the vehicle make, model, color, or license plate?",
  promptEs: "¿Tiene la marca, modelo, color o placa del vehículo?",
  field: "vehicleMake",
  policy: "never_repeat",
};

const VEHICLE_MODEL: IntakeQuestion = {
  id: "vehicle_model",
  prompt: "Do you know the vehicle model?",
  promptEs: "¿Sabe el modelo del vehículo?",
  field: "vehicleModel",
  policy: "never_repeat",
};

const VEHICLE_COLOR: IntakeQuestion = {
  id: "vehicle_color",
  prompt: "What color is the vehicle?",
  promptEs: "¿De qué color es el vehículo?",
  field: "vehicleColor",
  policy: "never_repeat",
};

const VEHICLE_PLATE: IntakeQuestion = {
  id: "vehicle_plate",
  prompt: "Do you have a license plate number?",
  promptEs: "¿Tiene el número de placa?",
  field: "vehiclePlate",
  policy: "never_repeat",
};

const SUSPECT: IntakeQuestion = {
  id: "suspect",
  prompt: "Can you describe the person involved — clothing, height, anything that stands out?",
  promptEs: "¿Puede describir a la persona — ropa, estatura, algo que destaque?",
  field: "suspectDescription",
  policy: "never_repeat",
};

const WEAPONS: IntakeQuestion = {
  id: "weapons",
  prompt: "Did you see any weapons?",
  promptEs: "¿Vio alguna arma?",
  field: "weaponsMentioned",
  policy: "clarify",
  required: true,
  clarifyPrompt: "Did you see a weapon? Yes or no.",
  clarifyPromptEs: "¿Vio un arma? Sí o no.",
};

const INJURIES: IntakeQuestion = {
  id: "injuries",
  prompt: "Is anyone hurt or injured?",
  promptEs: "¿Hay alguien herido?",
  field: "injuries",
  policy: "clarify",
  required: true,
  clarifyPrompt: "Is anyone hurt? Yes or no.",
  clarifyPromptEs: "¿Hay alguien herido? Sí o no.",
};

const BY_CLASS: Partial<Record<string, IntakeQuestion[]>> = {
  NOISE_COMPLAINT: [ALWAYS_LOCATION, APT, CROSS, IN_PROGRESS, CALLBACK],
  PARKING: [ALWAYS_LOCATION, APT, CROSS, VEHICLE, VEHICLE_COLOR, VEHICLE_PLATE, CALLBACK],
  TOW_COMPLAINT: [ALWAYS_LOCATION, APT, VEHICLE, VEHICLE_MODEL, VEHICLE_COLOR, VEHICLE_PLATE, CALLBACK],
  ANIMAL_CONTROL: [ALWAYS_LOCATION, APT, IN_PROGRESS, INJURIES, CALLBACK],
  CODE_ENFORCEMENT: [ALWAYS_LOCATION, APT, CROSS, CALLBACK],
  PUBLIC_WORKS: [ALWAYS_LOCATION, CROSS, CALLBACK],
  REPORT_ONLY: [ALWAYS_LOCATION, APT, IN_PROGRESS, VEHICLE, VEHICLE_PLATE, CALLBACK],
  CARFAX_REPORTING_ELIGIBLE: [ALWAYS_LOCATION, VEHICLE, VEHICLE_MODEL, VEHICLE_COLOR, VEHICLE_PLATE, IN_PROGRESS, CALLBACK],
  ONLINE_REPORTING_ELIGIBLE: [ALWAYS_LOCATION, CALLBACK],
  NON_EMERGENCY_POLICE: [
    ALWAYS_LOCATION,
    APT,
    CROSS,
    IN_PROGRESS,
    DIRECTION,
    SUSPECT,
    WEAPONS,
    INJURIES,
    VEHICLE,
    VEHICLE_COLOR,
    VEHICLE_PLATE,
    CALLBACK,
  ],
  INFORMATION_REQUEST: [CALLBACK],
  UNKNOWN: [ALWAYS_LOCATION, APT, IN_PROGRESS, CALLBACK],
};

export const AMBIGUOUS_INTAKE_ANSWER =
  /^(i\s+don'?t\s+know|dont\s+know|idk|no\s+s[eé]|not\s+sure|unsure|maybe|possibly|\?+|n\/?a|none|huh|um+|uh+|skip)$/i;

export function isAmbiguousIntakeAnswer(text: string | undefined | null): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  if (t.length < 2) return true;
  return AMBIGUOUS_INTAKE_ANSWER.test(t);
}

export function spokenIntakePrompt(
  q: Pick<IntakeQuestion, "prompt" | "promptEs" | "clarifyPrompt" | "clarifyPromptEs" | "clarify">,
  language?: string | null,
): string {
  const es = (language ?? "").toLowerCase().startsWith("es");
  if (q.clarify) {
    const clarify = es ? q.clarifyPromptEs ?? q.clarifyPrompt : q.clarifyPrompt;
    if (clarify?.trim()) return clarify.trim();
  }
  if (es && q.promptEs?.trim()) return q.promptEs.trim();
  return q.prompt;
}

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
  vehicleModel: "vehicleModel",
  vehicleColor: "vehicleColor",
  licensePlate: "vehiclePlate",
  suspectDesc: "suspectDescription",
  preferredLang: "preferredLanguage",
  incidentType: "incidentTypeHint",
  concernType: "incidentTypeHint",
  reportType: "incidentTypeHint",
  description: "summary",
  guestContact: "callbackNumber",
  aptBusiness: "apartmentSuite",
  crossStreets: "crossStreets",
  directionTravel: "directionOfTravel",
  weapons: "weaponsMentioned",
};

function fromFollowUp(q: FollowUpQuestion): IntakeQuestion {
  const field = TEMPLATE_FIELD_TO_INTAKE[q.fieldId] ?? "freeform";
  return {
    id: q.id,
    prompt: q.prompt,
    promptEs: q.promptEs,
    field,
    policy: q.policy ?? "ask",
    required: q.policy !== "skip" && q.policy !== "never_repeat" && field !== "freeform",
  };
}

function shouldSkipQuestion(
  q: IntakeQuestion,
  intake: CallIntakeData,
  asked: Set<string>,
): boolean {
  if (q.policy === "skip" && isFilled(intake, q.field)) return true;
  if (isFilled(intake, q.field)) return true;
  if (asked.has(q.id) && (q.policy === "never_repeat" || q.policy === "skip") && !q.required) {
    return true;
  }
  return false;
}

export type NextIntakeQuestionOpts = {
  lastUtterance?: string;
  askedQuestionIds?: string[] | null;
  lastQuestionId?: string | null;
  language?: string | null;
};

function findInQueue(queue: IntakeQuestion[], id: string | null | undefined): IntakeQuestion | undefined {
  if (!id) return undefined;
  return queue.find((q) => q.id === id);
}

/**
 * Next unanswered intake prompt with skip / clarify / never-repeat.
 * Emergency classification must never request more AI questions.
 */
export function nextIntakeQuestion(
  classification: CallTriageClassification,
  intake: CallIntakeData,
  taxonomy?: AgencyTaxonomy | null,
  opts?: NextIntakeQuestionOpts,
): IntakeQuestion | null {
  const matched = taxonomy ? findCallType(taxonomy, classification) : undefined;
  if (classification === "EMERGENCY" || classification === "emergency" || matched?.isEmergency) return null;

  const asked = new Set(opts?.askedQuestionIds ?? []);
  const queue: IntakeQuestion[] = [];

  if (taxonomy && matched) {
    for (const q of matched.followUpQuestions) {
      if (q.condition) {
        const condField = TEMPLATE_FIELD_TO_INTAKE[q.condition.fieldId];
        if (condField && condField !== "freeform") {
          const current = String(intake[condField] ?? "");
          if (current !== q.condition.value) continue;
        }
      }
      queue.push(fromFollowUp(q));
    }
    const template = taxonomy.intakeTemplates.find((t) => t.id === matched.intakeTemplateId);
    for (const f of template?.fields ?? []) {
      if (!f.required) continue;
      const field = TEMPLATE_FIELD_TO_INTAKE[f.id];
      if (!field || field === "freeform") continue;
      if (queue.some((q) => q.field === field || q.id === f.id)) continue;
      queue.push({
        id: f.id,
        prompt: f.helpText || `${f.label}?`,
        field,
        policy: "ask",
        required: true,
      });
    }
  }

  if (queue.length === 0) {
    queue.push(...(BY_CLASS[classification] ?? BY_CLASS.UNKNOWN ?? []));
  }

  const last = findInQueue(queue, opts?.lastQuestionId);
  if (last && isAmbiguousIntakeAnswer(opts?.lastUtterance) && !isFilled(intake, last.field)) {
    const policy = last.policy ?? "ask";
    if (last.required || policy === "ask" || policy === "clarify") {
      return { ...last, clarify: true };
    }
    asked.add(last.id);
  }

  return queue.find((q) => !shouldSkipQuestion(q, intake, asked)) ?? null;
}

export function recordAskedQuestion(askedQuestionIds: string[] | null | undefined, questionId: string): string[] {
  const next = [...(askedQuestionIds ?? [])];
  if (!next.includes(questionId)) next.push(questionId);
  return next;
}
