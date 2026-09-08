import type { CallAssistTenantConfig } from "../store.js";
import { CALL_ASSIST_VERTICAL_LABELS, callAssistUiVerticalFromAgency, resolveAgencyTaxonomy } from "rapid-cortex-shared";

export function agencyShortName(config: CallAssistTenantConfig): string {
  return config.agencyShortName?.trim() || config.shortName?.trim() || "this agency";
}

export function disclosurePrompt(config: CallAssistTenantConfig): string {
  return config.disclosureText;
}

export function openingPrompt(config: CallAssistTenantConfig): string {
  return `Thank you for calling ${agencyShortName(config)}. ${config.disclosureText} How can I help you today?`;
}

export function slotPrompt(config: CallAssistTenantConfig, slotId: string): string {
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

export function closingPrompt(config: CallAssistTenantConfig, callTypeId: string, caseNumber: string): string {
  const label = callTypeId.replace(/_/g, " ").toLowerCase();
  return (
    `I've created a report for your ${label}. ` +
    `Your case number is ${caseNumber}. ` +
    `Someone from ${agencyShortName(config)} will follow up if needed. ` +
    `Is there anything else I can help with?`
  );
}

export function transferPrompt(config: CallAssistTenantConfig, reason: "EMERGENCY" | "LOW_CONFIDENCE"): string {
  if (reason === "EMERGENCY") {
    return "I'm connecting you to a dispatcher right now. Please stay on the line.";
  }
  const vertical = callAssistUiVerticalFromAgency({
    vertical: config.vertical ?? config.uiVertical,
    uiVertical: config.uiVertical,
    agencyId: config.agencyId,
  });
  const target = CALL_ASSIST_VERTICAL_LABELS[vertical].transferTarget;
  return `I'm transferring you to ${target} who can better assist you. Please hold.`;
}

export function languageDetectionPrompt(): string {
  return "Para continuar en español, diga 'español'. To continue in English, please continue speaking.";
}
