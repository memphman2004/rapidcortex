import type { LexSlotValue } from "../types.js";
import { LEX_SPEC_SLOTS } from "../lex-spec-slots.js";
import { INTENT_MAP } from "./intents.js";
import { conversationalSlotValue, SLOT_VALUE_LABELS } from "./slot-value-labels.js";
import { slotNamesForIntent } from "./slot-catalog.js";

export { conversationalSlotValue, SLOT_VALUE_LABELS };

function slotFilled(slot: LexSlotValue | null | undefined): boolean {
  return Boolean(
    slot?.value?.interpretedValue?.trim() ||
      slot?.value?.originalValue?.trim() ||
      (slot?.value?.resolvedValues && slot.value.resolvedValues.length > 0),
  );
}

/**
 * Spoken questions keyed by `${intentName}/${slotName}`.
 * Keep these short — one human question, never a multiple-choice menu.
 */
export const ELICITATION_QUESTIONS: Record<string, string> = {
  "ReportTreesVegetation/TreeSubIssue": "What's going on with the tree?",
  "ReportTreesVegetation/ServiceAddress": "Got it. What street?",
  "ReportTreesVegetation/IsOngoing": "Still blocking anything right now?",

  "ReportRoadsInfrastructure/RoadsSubIssue": "What's wrong with the road?",
  "ReportRoadsInfrastructure/ServiceAddress": "What street?",
  "ReportRoadsInfrastructure/IsOngoing": "Blocking traffic right now?",

  "ReportNoiseComplaint/NoiseSubIssue": "What kind of noise?",
  "ReportNoiseComplaint/ServiceAddress": "Where's it coming from?",
  "ReportNoiseComplaint/IsOngoing": "Still going on right now?",

  "ReportSanitationWaste/SanitationSubIssue": "What's the trash issue?",
  "ReportSanitationWaste/ServiceAddress": "Got it. What's the address?",
  "ReportSanitationWaste/IsOngoing": "Still a problem right now?",

  "ReportVehicleIssue/VehicleSubIssue": "What's going on with the vehicle?",
  "ReportVehicleIssue/ServiceAddress": "What street is it on?",
  "ReportVehicleIssue/VehicleDescription": "What's it look like?",
  "ReportVehicleIssue/IsOngoing": "Still there right now?",

  "ReportBuildingsHousing/BuildingSubIssue": "What's going on at the property?",
  "ReportBuildingsHousing/ServiceAddress": "What's the address?",
  "ReportBuildingsHousing/IsOngoing": "Still happening right now?",

  "ReportWaterSewerDrainage/WaterSubIssue": "What's going on with the water?",
  "ReportWaterSewerDrainage/ServiceAddress": "What street or intersection?",
  "ReportWaterSewerDrainage/IsOngoing": "Still leaking or backing up?",

  "ReportAnimalsPests/AnimalSubIssue": "What kind of animal, and what's going on?",
  "ReportAnimalsPests/ServiceAddress": "Got it. What's the address?",
  "ReportAnimalsPests/IsOngoing": "Still there right now?",

  "ReportGraffitiVandalism/GraffitiSubIssue": "What got tagged?",
  "ReportGraffitiVandalism/ServiceAddress": "Where is it?",
  "ReportGraffitiVandalism/IsOngoing": "Just happen, or been there a while?",

  "ReportParksPublicSpaces/ParkSubIssue": "What's going on in the park?",
  "ReportParksPublicSpaces/ServiceAddress": "Which park, or nearest address?",
  "ReportParksPublicSpaces/IsOngoing": "Still a problem right now?",

  "ReportLawEnforcementNonEmergency/LawEnforcementSubIssue": "What's going on?",
  "ReportLawEnforcementNonEmergency/ServiceAddress": "What street?",
  "ReportLawEnforcementNonEmergency/IsOngoing": "Happening right now?",

  "ReportFireEMSNonEmergency/FireEMSSubIssue": "What's the fire safety concern?",
  "ReportFireEMSNonEmergency/ServiceAddress": "What's the address?",
  "ReportFireEMSNonEmergency/IsOngoing": "Still a problem right now?",

  "ReportHomelessSocialServices/HomelessSubIssue": "What's going on?",
  "ReportHomelessSocialServices/ServiceAddress": "Where is this?",
  "ReportHomelessSocialServices/IsOngoing": "Happening right now?",

  "ReportEnvironmentalHealth/EnvironmentalSubIssue": "What's the concern?",
  "ReportEnvironmentalHealth/ServiceAddress": "What address or area?",
  "ReportEnvironmentalHealth/IsOngoing": "Still happening right now?",

  "ReportTransitIssue/TransitSubIssue": "What's the transit issue?",
  "ReportTransitIssue/ServiceAddress": "What street or stop?",
  "ReportTransitIssue/IsOngoing": "Still a problem right now?",

  "ReportStreetLighting/LightingSubIssue": "What's wrong with the light?",
  "ReportStreetLighting/ServiceAddress": "What street or intersection?",
  "ReportStreetLighting/IsOngoing": "Out right now?",

  "ReportTrafficSignsMarkings/SignsSubIssue": "What's wrong with the sign?",
  "ReportTrafficSignsMarkings/ServiceAddress": "What intersection?",
  "ReportTrafficSignsMarkings/IsOngoing": "Still a problem there?",

  "RequestGovernmentInformation/GovInfoSubIssue": "What are you looking for?",
  "RequestGovernmentInformation/CallerName": "Want to leave a name, or stay anonymous?",
  "RequestGovernmentInformation/CallbackNumber": "Want a callback number?",

  "ReportSpecialEventIssue/SpecialEventSubIssue": "What's going on with the event?",
  "ReportSpecialEventIssue/ServiceAddress": "What street or area?",

  "CheckServiceRequestStatus/ServiceStatusSubIssue": "Checking on a request, or following up?",
  "CheckServiceRequestStatus/ServiceRequestNumber": "Got a confirmation number?",
};

const GENERIC_BY_SLOT: Record<string, string> = {
  ServiceAddress: "Got it. What's the address?",
  IsOngoing: "Still happening right now?",
  CallerName: "Want to leave a name, or stay anonymous?",
  CallbackNumber: "Want a callback number?",
  IssueDescription: "Anything else I should know?",
};

function looksLikeSubIssueSlot(slotName: string): boolean {
  return /SubIssue$/i.test(slotName) || /subissue/i.test(slotName);
}

/** Strip camelCase Lex identifiers if they ever leak into citizen-facing copy. */
export function stripLexInternalNames(text: string): string {
  let out = text.replace(
    /\b(Can you tell me more about the )?(IsOngoing|ServiceAddress|TreeSubIssue|RoadsSubIssue|NoiseSubIssue|SanitationSubIssue|WaterSubIssue|VehicleSubIssue|BuildingSubIssue|AnimalSubIssue|GraffitiSubIssue|ParkSubIssue|LawEnforcementSubIssue|FireEMSSubIssue|HomelessSubIssue|EnvironmentalSubIssue|TransitSubIssue|LightingSubIssue|SignsSubIssue|GovInfoSubIssue|SpecialEventSubIssue|ServiceStatusSubIssue|ServiceRequestNumber|IssueDescription|CallerName|CallbackNumber|VehicleDescription)\??/g,
    "",
  );
  out = out.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
  return out;
}

/** Never expose camelCase Lex slot names to citizens. */
export function humanQuestionForSlot(intentName: string, slotName: string, language?: string): string {
  const keyed = ELICITATION_QUESTIONS[`${intentName}/${slotName}`];
  if (keyed) return keyed;
  const spec = LEX_SPEC_SLOTS[intentName]?.find((slot) => slot.name === slotName);
  if (spec) {
    const prompt = language?.toLowerCase().startsWith("es") ? spec.promptEs : spec.promptEn;
    if (prompt?.trim()) return prompt.trim();
  }
  if (slotName === "CallerName") {
    return "Want to leave a name, or stay anonymous?";
  }
  if (slotName === "CallbackNumber") {
    return "Want a callback number?";
  }
  if (GENERIC_BY_SLOT[slotName]) return GENERIC_BY_SLOT[slotName];
  if (looksLikeSubIssueSlot(slotName)) {
    return "What's going on?";
  }
  const fromIntent = INTENT_MAP[intentName]?.slots.find((s) => s.name === slotName)?.elicitationPrompt;
  if (fromIntent?.trim() && !fromIntent.includes(slotName) && !/or something else/i.test(fromIntent)) {
    return fromIntent.trim();
  }
  return "Say that again?";
}

/**
 * First unfilled required slot with a human-written question.
 * Returns null only when all required slots are filled (caller may Delegate).
 */
export function getNextElicitation(
  intentName: string,
  slots: Record<string, LexSlotValue | null>,
  _transcript: string,
  language?: string,
): { slotToElicit: string; question: string } | null {
  const intentDef = INTENT_MAP[intentName];
  if (!intentDef?.slots?.length) {
    const allowed = slotNamesForIntent(intentName);
    for (const [slotName, slot] of Object.entries(slots)) {
      if (slotFilled(slot)) continue;
      if (allowed.size > 0 && !allowed.has(slotName) && slotName !== "location") continue;
      if (allowed.size === 0 && /^(ServiceAddress|IsOngoing|CallerName|CallbackNumber)$/.test(slotName)) continue;
      if (/^[A-Z]/.test(slotName) || slotName === "location") {
        return { slotToElicit: slotName, question: humanQuestionForSlot(intentName, slotName, language) };
      }
    }
    return null;
  }

  const ordered = [...intentDef.slots].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  for (const slot of ordered) {
    if (!slot.isRequired) continue;
    if (slotFilled(slots[slot.name])) continue;
    return {
      slotToElicit: slot.name,
      question: humanQuestionForSlot(intentName, slot.name, language),
    };
  }
  return null;
}
