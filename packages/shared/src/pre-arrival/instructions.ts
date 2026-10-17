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
    protocolId: "GENERIC_MEDICAL_v1",
    cadNaturePatterns: ["*"],
    steps: [
      { text: "Stay calm — help is on the way. Keep this phone nearby.", category: "GENERAL" },
      { text: "Unlock your door or send someone outside so responders can find you.", category: "SCENE_SAFETY" },
      { text: "Do not give food or water unless your dispatcher instructs you to.", category: "GENERAL" },
    ],
  },
];

export const GENERIC_FALLBACK_STEPS: string[] = [
  "Stay calm — help is coming.",
  "Keep this phone nearby so we can reach you.",
  "Unlock your door if it is safe so responders can get in quickly.",
];
