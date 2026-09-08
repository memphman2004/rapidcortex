import type { CallTriageResult } from "./triage.js";
import type { SafetyDecision } from "./safety.js";
import type { CallIntakeData } from "./intake.js";
import type { RoutingRecommendation } from "./routing.js";
import type { CallAssistPremiseHazard } from "./cad-types.js";
import { EMERGENCY_TRANSFER_ACTION } from "./classifications.js";

export type TransferPackage = {
  sessionId: string;
  agencyId: string;
  action: typeof EMERGENCY_TRANSFER_ACTION | "TRANSFER_HUMAN" | "TRANSFER_EXTERNAL" | "CONTINUE";
  continueAiConversation: boolean;
  classification: CallTriageResult["primaryClassification"];
  safety: SafetyDecision;
  intake: CallIntakeData;
  routing: RoutingRecommendation;
  transcriptSummary: string;
  spokenCallerScript: string;
  spokenReceiverSummary: string;
  premiseHazards: CallAssistPremiseHazard[];
  duplicateCadIds: string[];
  chronicLocation: boolean;
  repeatCaller: boolean;
  ttyMode: boolean;
  language: string;
  videoAssistHint?: string;
  createdAt: string;
};

export function buildTransferPackage(input: {
  sessionId: string;
  agencyId: string;
  triage: CallTriageResult;
  safety: SafetyDecision;
  intake: CallIntakeData;
  routing: RoutingRecommendation;
  utterances: string[];
  premiseHazards?: CallAssistPremiseHazard[];
  duplicateCadIds?: string[];
  chronicLocation?: boolean;
  repeatCaller?: boolean;
  ttyMode?: boolean;
  language?: string;
  videoAssistHint?: string;
  nowIso?: string;
}): TransferPackage {
  const emergency = input.safety.action === EMERGENCY_TRANSFER_ACTION;
  const action = emergency
    ? EMERGENCY_TRANSFER_ACTION
    : input.routing.destinationType === "EXTERNAL_AGENCY"
      ? "TRANSFER_EXTERNAL"
      : input.routing.destinationType === "CALL_TAKER" || input.routing.destinationType === "CALL_QUEUE"
        ? "TRANSFER_HUMAN"
        : "CONTINUE";

  const transcriptSummary = input.utterances
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(-8)
    .join(" | ")
    .slice(0, 2000);

  const spokenReceiverSummary =
    input.routing.spokenReceiverSummary ??
    [
      "Rapid Cortex Call Assist transfer.",
      `Classification: ${input.triage.primaryClassification}.`,
      input.intake.locationText ? `Location: ${input.intake.locationText}.` : "",
      input.intake.apartmentSuite ? `Apt/suite: ${input.intake.apartmentSuite}.` : "",
      input.intake.crossStreets ? `Cross streets: ${input.intake.crossStreets}.` : "",
      input.intake.directionOfTravel ? `Direction of travel: ${input.intake.directionOfTravel}.` : "",
      [input.intake.vehicleColor, input.intake.vehicleYear, input.intake.vehicleMake, input.intake.vehicleModel, input.intake.vehiclePlate]
        .filter(Boolean)
        .length
        ? `Vehicle: ${[input.intake.vehicleColor, input.intake.vehicleYear, input.intake.vehicleMake, input.intake.vehicleModel, input.intake.vehiclePlate].filter(Boolean).join(" ")}.`
        : "",
      input.intake.suspectDescription ? `Suspect: ${input.intake.suspectDescription}.` : "",
      input.intake.weaponsMentioned ? `Weapons: ${input.intake.weaponsDetail ?? "mentioned"}.` : "",
      input.intake.injuries === true ? `Injuries: ${input.intake.injuriesDetail ?? "reported"}.` : "",
      input.intake.callbackNumber ? `Callback: ${input.intake.callbackNumber}.` : "",
      input.intake.summary ? `Summary: ${input.intake.summary}.` : `Caller said: ${transcriptSummary.slice(0, 280)}.`,
    ]
      .filter(Boolean)
      .join(" ");

  return {
    sessionId: input.sessionId,
    agencyId: input.agencyId,
    action,
    continueAiConversation: emergency ? false : input.triage.continueIntake && action === "CONTINUE",
    classification: input.triage.primaryClassification,
    safety: input.safety,
    intake: input.intake,
    routing: input.routing,
    transcriptSummary,
    spokenCallerScript: input.routing.spokenCallerScript,
    spokenReceiverSummary,
    premiseHazards: input.premiseHazards ?? [],
    duplicateCadIds: input.duplicateCadIds ?? [],
    chronicLocation: Boolean(input.chronicLocation),
    repeatCaller: Boolean(input.repeatCaller),
    ttyMode: Boolean(input.ttyMode),
    language: input.language ?? "en",
    videoAssistHint: input.videoAssistHint,
    createdAt: input.nowIso ?? new Date().toISOString(),
  };
}
