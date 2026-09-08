import type { CallAssistTenantConfig } from "../store.js";
import { ResponseGenerator, resolveAgencyTaxonomy, responseVoiceFromConfig } from "rapid-cortex-shared";
import { LEX_SPEC_SLOTS } from "./lex-spec-slots.js";

export function agencyShortName(config: CallAssistTenantConfig): string {
  return config.agencyShortName?.trim() || config.shortName?.trim() || "this agency";
}

export function responsesFor(config: CallAssistTenantConfig): ResponseGenerator {
  return new ResponseGenerator(responseVoiceFromConfig(config));
}

export function disclosurePrompt(config: CallAssistTenantConfig): string {
  return responsesFor(config).opening();
}

export function openingPrompt(config: CallAssistTenantConfig): string {
  return responsesFor(config).opening();
}

export function slotPrompt(
  config: CallAssistTenantConfig,
  slotId: string,
  localeId = "en_US",
  intentName?: string,
): string {
  if (intentName) {
    const forIntent = LEX_SPEC_SLOTS[intentName]?.find((field) => field.name === slotId);
    if (forIntent) return localeId.startsWith("es") ? forIntent.promptEs : forIntent.promptEn;
  }
  for (const slots of Object.values(LEX_SPEC_SLOTS)) {
    const spec = slots.find((field) => field.name === slotId);
    if (spec) return localeId.startsWith("es") ? spec.promptEs : spec.promptEn;
  }
  const taxonomy = resolveAgencyTaxonomy(config);
  for (const tpl of taxonomy.intakeTemplates) {
    const field = tpl.fields.find((f) => f.id === slotId);
    if (field?.placeholder) return field.placeholder;
    if (field?.label) return `${field.label}?`;
  }
  return defaultSlotPrompt(slotId);
}

function defaultSlotPrompt(slotId: string): string {
  const defaults: Record<string, string> = {
    location: "What is the address or location?",
    crossStreets: "What are the nearest cross streets?",
    aptBusiness: "Is there an apartment number or business name?",
    vehicleMake: "Can you describe the vehicle, including the color and make?",
    licensePlate: "Do you have the license plate number?",
    suspectDesc: "Can you describe the person?",
    injuries: "Are there any injuries?",
    weapons: "Are there any weapons involved?",
    callbackNumber: "What is the best callback number for you?",
    callerName: "May I have your name?",
    building: "Which building are you in or near?",
    room: "What room or area?",
    section: "What section are you in?",
    rowSeat: "What row and seat?",
    description: "Can you describe what's happening?",
    medicalNeeded: "Does anyone need medical attention?",
  };
  return defaults[slotId] ?? `Can you tell me more about the ${slotId}?`;
}

export function closingPrompt(config: CallAssistTenantConfig, _callTypeId: string, caseNumber: string): string {
  return responsesFor(config).incidentCreated(caseNumber);
}

export function transferPrompt(
  config: CallAssistTenantConfig,
  reason: "EMERGENCY" | "LOW_CONFIDENCE" | "HUMAN_REQUEST",
): string {
  const spoken = responsesFor(config);
  if (reason === "EMERGENCY") return spoken.emergencyTransfer();
  if (reason === "HUMAN_REQUEST") return spoken.humanTransfer();
  return spoken.fallbackTransfer();
}

export function languageDetectionPrompt(): string {
  return "Para continuar en español, diga 'español'. To continue in English, please continue speaking.";
}
