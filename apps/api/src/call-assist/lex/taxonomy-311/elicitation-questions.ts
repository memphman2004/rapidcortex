import type { LexSlotValue } from "../types.js";
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

/** Human-readable questions keyed by `${intentName}/${slotName}`. */
export const ELICITATION_QUESTIONS: Record<string, string> = {
  "ReportTreesVegetation/TreeSubIssue":
    "What type of tree issue is it — a fallen tree, a dead tree needing removal, overgrown branches, or something else?",
  "ReportTreesVegetation/ServiceAddress": "What street or intersection is the tree at?",
  "ReportTreesVegetation/IsOngoing":
    "Is the tree down right now and blocking access, or has it already been partially cleared?",

  "ReportRoadsInfrastructure/RoadsSubIssue":
    "What's the road issue — a pothole, damaged sidewalk, flooding, debris in the road, or something else?",
  "ReportRoadsInfrastructure/ServiceAddress": "What street or intersection is the problem at?",
  "ReportRoadsInfrastructure/IsOngoing": "Is it blocking traffic right now?",

  "ReportNoiseComplaint/NoiseSubIssue":
    "What kind of noise — loud music, a party, construction, a barking dog, car alarm, or something else?",
  "ReportNoiseComplaint/ServiceAddress": "What address or cross streets is the noise coming from?",
  "ReportNoiseComplaint/IsOngoing": "Is it happening right now?",

  "ReportSanitationWaste/SanitationSubIssue":
    "Is this a missed pickup, illegal dumping, an overflowing trash can, or something else?",
  "ReportSanitationWaste/ServiceAddress": "What address or street is the issue at?",
  "ReportSanitationWaste/IsOngoing": "Is this still a problem right now?",

  "ReportVehicleIssue/VehicleSubIssue":
    "Is the vehicle abandoned, blocking a driveway or hydrant, parked illegally, or something else?",
  "ReportVehicleIssue/ServiceAddress": "What street or address is the vehicle at?",
  "ReportVehicleIssue/VehicleDescription":
    "Can you describe the vehicle — color, type, and license plate if visible?",
  "ReportVehicleIssue/IsOngoing": "Is the vehicle still there right now?",

  "ReportBuildingsHousing/BuildingSubIssue":
    "What's the issue — no heat, mold, unsafe conditions, unpermitted construction, or something else?",
  "ReportBuildingsHousing/ServiceAddress": "What's the address of the property?",
  "ReportBuildingsHousing/IsOngoing": "Is this happening right now?",

  "ReportWaterSewerDrainage/WaterSubIssue":
    "Is this a water main break, fire hydrant issue, no water service, water quality concern, sewer backup, or blocked drain?",
  "ReportWaterSewerDrainage/ServiceAddress": "What's the street address or intersection?",
  "ReportWaterSewerDrainage/IsOngoing": "Is water still leaking or backing up right now?",

  "ReportAnimalsPests/AnimalSubIssue":
    "What kind of animal issue — stray dog, aggressive animal, rodents, wildlife, dead animal pickup, or something else?",
  "ReportAnimalsPests/ServiceAddress": "What address or area is the animal at?",
  "ReportAnimalsPests/IsOngoing": "Is the animal still there right now?",

  "ReportGraffitiVandalism/GraffitiSubIssue":
    "What was tagged or vandalized — a public building, bridge, bus shelter, park equipment, or private property?",
  "ReportGraffitiVandalism/ServiceAddress": "What's the address or location?",
  "ReportGraffitiVandalism/IsOngoing": "Did this just happen, or has it been there a while?",

  "ReportParksPublicSpaces/ParkSubIssue":
    "What's the issue in the park — broken equipment, lighting, restroom, vandalism, or something else?",
  "ReportParksPublicSpaces/ServiceAddress": "Which park, or what's the nearest address?",
  "ReportParksPublicSpaces/IsOngoing": "Is this a problem there right now?",

  "ReportLawEnforcementNonEmergency/LawEnforcementSubIssue":
    "What's the concern — chronic drug activity, speeding, a theft that already happened, extra patrol needed, or something else?",
  "ReportLawEnforcementNonEmergency/ServiceAddress": "What street or address?",
  "ReportLawEnforcementNonEmergency/IsOngoing": "Is this happening right now?",

  "ReportFireEMSNonEmergency/FireEMSSubIssue":
    "What's the fire safety concern — a hazard, blocked hydrant or fire lane, illegal burning, or a safety question?",
  "ReportFireEMSNonEmergency/ServiceAddress": "What's the address?",
  "ReportFireEMSNonEmergency/IsOngoing": "Is this a problem right now?",

  "ReportHomelessSocialServices/HomelessSubIssue":
    "Is this a report of an encampment, a welfare check on someone, needles on the ground, or a request for services?",
  "ReportHomelessSocialServices/ServiceAddress": "Where is this located?",
  "ReportHomelessSocialServices/IsOngoing": "Is this happening right now?",

  "ReportEnvironmentalHealth/EnvironmentalSubIssue":
    "What's the issue — an odor or air quality complaint, illegal burning, a spill, food safety concern, or something else?",
  "ReportEnvironmentalHealth/ServiceAddress": "What address or area?",
  "ReportEnvironmentalHealth/IsOngoing": "Is this happening right now?",

  "ReportTransitIssue/TransitSubIssue":
    "What's the transit issue — bus stop damage, bike lane blocked, scooter on the sidewalk, broken meter, or something else?",
  "ReportTransitIssue/ServiceAddress": "What street or stop?",
  "ReportTransitIssue/IsOngoing": "Is this still a problem right now?",

  "ReportStreetLighting/LightingSubIssue":
    "Is this a streetlight out, a traffic signal problem, a damaged pole, or something else?",
  "ReportStreetLighting/ServiceAddress": "What street or intersection is the light at?",
  "ReportStreetLighting/IsOngoing": "Is it out or broken right now?",

  "ReportTrafficSignsMarkings/SignsSubIssue":
    "What's the sign or marking issue — missing stop sign, faded lines, damaged sign, or something else?",
  "ReportTrafficSignsMarkings/ServiceAddress": "What intersection or street?",
  "ReportTrafficSignsMarkings/IsOngoing": "Is this a problem there right now?",

  "RequestGovernmentInformation/GovInfoSubIssue":
    "What city information do you need — hours, a permit, a license, vital records, voting, or something else?",
  "RequestGovernmentInformation/CallerName":
    "Can I get your name for this request, or you can stay anonymous.",
  "RequestGovernmentInformation/CallbackNumber":
    "Want a callback number in case we need to send you to the right office?",

  "ReportSpecialEventIssue/SpecialEventSubIssue":
    "Is this about a street closure, event noise, a permit, a parade, or something else?",
  "ReportSpecialEventIssue/ServiceAddress": "What street or area is the event near?",

  "CheckServiceRequestStatus/ServiceStatusSubIssue":
    "Are you checking status, trying to reopen a closed request, or following up because it isn't done yet?",
  "CheckServiceRequestStatus/ServiceRequestNumber":
    "What's the confirmation or service request number, if you have it?",
};

const GENERIC_BY_SLOT: Record<string, string> = {
  ServiceAddress: "What's the address or nearest intersection?",
  IsOngoing: "Is this happening right now?",
  CallerName: "Can I get your name for the report, or you can stay anonymous.",
  CallbackNumber: "Want to leave a callback number for updates on your request?",
  IssueDescription: "Can you describe the issue in a bit more detail?",
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
export function humanQuestionForSlot(intentName: string, slotName: string): string {
  const keyed = ELICITATION_QUESTIONS[`${intentName}/${slotName}`];
  if (keyed) return keyed;
  if (slotName === "CallerName") {
    return "Can I get your name for the report, or you can stay anonymous.";
  }
  if (slotName === "CallbackNumber") {
    return "Want to leave a callback number for updates on your request?";
  }
  if (GENERIC_BY_SLOT[slotName]) return GENERIC_BY_SLOT[slotName];
  if (looksLikeSubIssueSlot(slotName)) {
    return "Can you describe the issue in a bit more detail?";
  }
  const fromIntent = INTENT_MAP[intentName]?.slots.find((s) => s.name === slotName)?.elicitationPrompt;
  if (fromIntent?.trim() && !fromIntent.includes(slotName)) return fromIntent.trim();
  return "Can you share a bit more detail so we can log this correctly?";
}

/**
 * First unfilled required slot with a human-written question.
 * Returns null only when all required slots are filled (caller may Delegate).
 */
export function getNextElicitation(
  intentName: string,
  slots: Record<string, LexSlotValue | null>,
  _transcript: string,
): { slotToElicit: string; question: string } | null {
  const intentDef = INTENT_MAP[intentName];
  if (!intentDef?.slots?.length) {
    const allowed = slotNamesForIntent(intentName);
    for (const [slotName, slot] of Object.entries(slots)) {
      if (slotFilled(slot)) continue;
      if (allowed.size > 0 && !allowed.has(slotName) && slotName !== "location") continue;
      if (allowed.size === 0 && /^(ServiceAddress|IsOngoing|CallerName|CallbackNumber)$/.test(slotName)) continue;
      if (/^[A-Z]/.test(slotName) || slotName === "location") {
        return { slotToElicit: slotName, question: humanQuestionForSlot(intentName, slotName) };
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
      question: humanQuestionForSlot(intentName, slot.name),
    };
  }
  return null;
}
