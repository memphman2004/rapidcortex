import { z } from "zod";
import type { StepCategory } from "./reconciliation-types.js";

/** Drives the caller "Guidance While You Wait" section. */
export const responseIQInstructionSchema = z.object({
  stepId: z.string().min(1),
  order: z.number().int().nonnegative(),
  text: z.string().min(1).max(2000),
  category: z
    .enum([
      "SCENE_SAFETY",
      "AIRWAY",
      "BREATHING",
      "CIRCULATION",
      "CPR",
      "DEFIBRILLATION",
      "BLEEDING_CONTROL",
      "POSITIONING",
      "ENVIRONMENTAL",
      "EVACUATION",
      "COMMUNICATION",
      "MEDICATION",
      "GENERAL",
    ])
    .default("GENERAL"),
  status: z.enum(["ACTIVE", "COMPLETED", "SUSPENDED", "SKIPPED"]).default("ACTIVE"),
});
export type ResponseIQInstruction = z.infer<typeof responseIQInstructionSchema>;

export type ProtocolLibraryEntry = {
  protocolId: string;
  cadNaturePatterns: string[];
  steps: Array<{ text: string; category: StepCategory }>;
};

/** Built-in protocol library defaults (CPR, CHOKING, etc.). */
export const DEFAULT_PROTOCOL_LIBRARY: ProtocolLibraryEntry[] = [
  {
    protocolId: "CARDIAC_ARREST_v1",
    cadNaturePatterns: ["CARDIAC*", "CARDIAC_ARREST", "CHEST_PAIN"],
    steps: [
      { text: "Call 911 — keep the line open if you can while waiting for responders.", category: "COMMUNICATION" },
      { text: "Unlock your front door or send someone outside so responders can reach you quickly.", category: "SCENE_SAFETY" },
      { text: "If the person is unresponsive and not breathing normally, begin CPR if you are trained.", category: "CPR" },
    ],
  },
  {
    protocolId: "CHOKING_v1",
    cadNaturePatterns: ["CHOKING*", "AIRWAY_OBSTRUCTION"],
    steps: [
      { text: "Stay on the line with your dispatcher and follow their coaching.", category: "COMMUNICATION" },
      { text: "If the person can cough or speak, encourage them to keep coughing.", category: "AIRWAY" },
      { text: "If they cannot breathe, cough, or speak, begin abdominal thrusts if you are trained.", category: "AIRWAY" },
    ],
  },
  {
    protocolId: "FIRE_v1",
    cadNaturePatterns: ["FIRE*", "STRUCTURE_FIRE", "SMOKE*"],
    steps: [
      { text: "Get everyone out of the building if it is safe to do so. Do not re-enter.", category: "EVACUATION" },
      { text: "Meet at a safe location away from the structure and account for everyone.", category: "SCENE_SAFETY" },
      { text: "Tell dispatchers which exits you used and whether anyone is still inside.", category: "COMMUNICATION" },
    ],
  },
  {
    protocolId: "CRIME_IN_PROGRESS_v1",
    cadNaturePatterns: [
      "*ROBBERY*",
      "*BURGLAR*",
      "*ASSAULT*",
      "*THEFT*",
      "*INVASION*",
      "*WEAPON*",
      "*STABB*",
      "*FIGHT*",
      "*DISTURBANCE*",
      "*SUSPICIOUS*",
      "211",
    ],
    steps: [
      {
        text: "You did the right thing by calling. Stay on the phone if you can do it safely.",
        category: "COMMUNICATION",
      },
      {
        text: "If you can, move somewhere you can lock the door. Stay quiet and out of sight.",
        category: "SCENE_SAFETY",
      },
      {
        text: "Do not open the door until responders identify themselves. Do not confront anyone.",
        category: "SCENE_SAFETY",
      },
    ],
  },
  {
    protocolId: "GENERIC_MEDICAL_v1",
    cadNaturePatterns: [
      "MEDICAL*",
      "EMS*",
      "ILLNESS*",
      "SICK*",
      "INJURY*",
      "INJURED*",
      "FALL*",
      "SEIZURE*",
      "OVERDOSE*",
      "UNCONSCIOUS*",
      "BLEED*",
      "PATIENT*",
    ],
    steps: [
      { text: "Stay with them if it is safe. Help is on the way — keep this phone nearby.", category: "GENERAL" },
      { text: "Unlock the door only if it is safe, so responders can reach you.", category: "SCENE_SAFETY" },
      { text: "Do not give food, drink, or medicine unless your dispatcher tells you to.", category: "GENERAL" },
    ],
  },
  {
    protocolId: "GENERIC_SAFETY_v1",
    cadNaturePatterns: ["*"],
    steps: [
      { text: "You are not alone. Help is on the way — keep this phone with you.", category: "COMMUNICATION" },
      { text: "Tell your dispatcher if anything changes, including if you need to move.", category: "COMMUNICATION" },
      { text: "If you are safe where you are, stay there. If you are not, move somewhere safer and say so.", category: "SCENE_SAFETY" },
    ],
  },
];

export const GENERIC_FALLBACK_STEPS: string[] = [
  "You are not alone. Help is on the way.",
  "Keep this phone nearby so we can reach you.",
  "If you are safe where you are, stay there. If you are not, move somewhere safer and tell the dispatcher.",
];
