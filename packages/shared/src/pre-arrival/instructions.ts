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

/** Built-in protocol library defaults. More specific entries must appear before catch-alls. */
export const DEFAULT_PROTOCOL_LIBRARY: ProtocolLibraryEntry[] = [
  {
    protocolId: "CARDIAC_ARREST_v1",
    cadNaturePatterns: ["CARDIAC*", "CARDIAC_ARREST", "CHEST_PAIN"],
    steps: [
      { text: "Stay on the line if you can. Help is coming.", category: "COMMUNICATION" },
      { text: "Unlock the door only if it is safe so responders can reach you.", category: "SCENE_SAFETY" },
      { text: "If they are unresponsive and not breathing normally, begin CPR if you are trained.", category: "CPR" },
    ],
  },
  {
    protocolId: "CHOKING_v1",
    cadNaturePatterns: ["CHOKING*", "AIRWAY_OBSTRUCTION"],
    steps: [
      { text: "Stay on the line with your dispatcher and follow their coaching.", category: "COMMUNICATION" },
      { text: "If they can cough or speak, encourage them to keep coughing.", category: "AIRWAY" },
      { text: "If they cannot breathe, cough, or speak, begin abdominal thrusts if you are trained.", category: "AIRWAY" },
    ],
  },
  {
    protocolId: "FIRE_v1",
    cadNaturePatterns: ["FIRE*", "STRUCTURE_FIRE", "SMOKE*", "*WILDLAND*", "*BRUSH*"],
    steps: [
      { text: "Get everyone out if it is safe. Do not go back inside.", category: "EVACUATION" },
      { text: "Meet at a safe place away from the building or smoke and account for everyone.", category: "SCENE_SAFETY" },
      { text: "Tell the person on the phone which exit you used and whether anyone is still inside.", category: "COMMUNICATION" },
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
    protocolId: "VEHICLE_CRASH_v1",
    cadNaturePatterns: [
      "*CRASH*",
      "*MVC*",
      "*MVA*",
      "*COLLISION*",
      "*HIT_AND_RUN*",
      "*HITANDRUN*",
      "*TRAFFIC_ACCIDENT*",
      "*VEHICLE_ACCIDENT*",
    ],
    steps: [
      {
        text: "If you can do it safely, turn on hazard lights and stay out of traffic.",
        category: "SCENE_SAFETY",
      },
      {
        text: "Do not move anyone who is hurt unless they are in immediate danger from fire or traffic.",
        category: "POSITIONING",
      },
      {
        text: "Keep this phone with you and tell the dispatcher if anyone’s condition changes.",
        category: "COMMUNICATION",
      },
    ],
  },
  {
    protocolId: "OVERDOSE_v1",
    cadNaturePatterns: ["*OVERDOSE*", "*OD_*", "OD", "*NARCAN*", "*OPIOID*"],
    steps: [
      { text: "Stay with them. Do not leave them alone.", category: "GENERAL" },
      {
        text: "If they stop breathing or you cannot wake them, tell the dispatcher right away.",
        category: "BREATHING",
      },
      {
        text: "Use naloxone (Narcan) only if you have it and know how. Unlock the door if it is safe.",
        category: "MEDICATION",
      },
    ],
  },
  {
    protocolId: "STROKE_v1",
    cadNaturePatterns: ["*STROKE*", "*CVA*", "*TIA*"],
    steps: [
      {
        text: "Note the time they were last seen normal — responders will ask for it.",
        category: "COMMUNICATION",
      },
      {
        text: "Help them sit or lie still. Do not give food, drink, or medicine.",
        category: "GENERAL",
      },
      {
        text: "Unlock the door if it is safe and keep this phone nearby.",
        category: "SCENE_SAFETY",
      },
    ],
  },
  {
    protocolId: "UNCONSCIOUS_v1",
    cadNaturePatterns: ["*UNCONSCIOUS*", "*UNRESPONSIVE*", "*PASSED_OUT*", "*SYNCOPE*"],
    steps: [
      { text: "Stay with them. Try to wake them by speaking loudly or gently shaking a shoulder.", category: "GENERAL" },
      {
        text: "If they are not breathing normally, tell the dispatcher and begin CPR if you are trained.",
        category: "CPR",
      },
      {
        text: "Unlock the door if it is safe so responders can get in quickly.",
        category: "SCENE_SAFETY",
      },
    ],
  },
  {
    protocolId: "RESPIRATORY_v1",
    cadNaturePatterns: [
      "*RESPIRATORY*",
      "*BREATHING*",
      "*SHORTNESS*",
      "*DIFFICULTY_BREATH*",
      "*ASTHMA*",
      "*COPD*",
    ],
    steps: [
      {
        text: "Help them sit upright if they can. Loosen tight clothing around the neck and chest.",
        category: "BREATHING",
      },
      {
        text: "Stay calm with them and keep this phone nearby so we can coach you.",
        category: "COMMUNICATION",
      },
      {
        text: "Unlock the door if it is safe. Tell the dispatcher if breathing gets worse.",
        category: "SCENE_SAFETY",
      },
    ],
  },
  {
    protocolId: "SEIZURE_v1",
    cadNaturePatterns: ["*SEIZURE*", "*CONVULSION*", "*EPILEP*"],
    steps: [
      {
        text: "Clear hard or sharp objects away from them. Do not put anything in their mouth.",
        category: "SCENE_SAFETY",
      },
      {
        text: "Do not hold them down. Cushion their head if you can do it safely.",
        category: "POSITIONING",
      },
      {
        text: "Note about how long the seizure lasts and tell the dispatcher when it stops.",
        category: "COMMUNICATION",
      },
    ],
  },
  {
    protocolId: "WATER_RESCUE_v1",
    cadNaturePatterns: ["*WATER_RESCUE*", "*DROWN*", "*WATER_RESC*"],
    steps: [
      {
        text: "Do not enter the water. Stay where you can see them if it is safe.",
        category: "SCENE_SAFETY",
      },
      {
        text: "Point, shout, or throw a flotation aid only if you can do it without going in.",
        category: "GENERAL",
      },
      {
        text: "Keep this phone with you and tell the dispatcher exactly where you are.",
        category: "COMMUNICATION",
      },
    ],
  },
  {
    protocolId: "HAZMAT_EVACUATE_v1",
    cadNaturePatterns: [
      "*GAS_LEAK*",
      "*GASLEAK*",
      "*NATURAL_GAS*",
      "*CARBON_MONOXIDE*",
      "*CO_ALARM*",
      "*COALARM*",
      "CO",
      "*HAZMAT*",
      "*HAZARDOUS*",
      "*CHEMICAL*",
      "*ELECTRICAL_HAZARD*",
      "*ELECTROCUTION*",
      "*DOWNED_WIRE*",
      "*BUILDING_COLLAPSE*",
      "*COLLAPSE*",
    ],
    steps: [
      {
        text: "Get yourself and others to fresh air or a safe distance. Do not go back in.",
        category: "EVACUATION",
      },
      {
        text: "Do not turn lights or appliances on or off, and do not use elevators if there is a gas smell.",
        category: "ENVIRONMENTAL",
      },
      {
        text: "Meet at a safe spot outside and tell the dispatcher where you are and who is with you.",
        category: "COMMUNICATION",
      },
    ],
  },
  {
    protocolId: "WELFARE_CHECK_v1",
    cadNaturePatterns: ["*WELFARE*", "*WELLNESS*", "*CHECK_WELL*", "*WELL_BEING*"],
    steps: [
      {
        text: "Stay with them if it is safe. You are not alone — help is on the way.",
        category: "GENERAL",
      },
      {
        text: "Keep this phone nearby and tell the dispatcher if anything changes.",
        category: "COMMUNICATION",
      },
      {
        text: "Unlock the door only if it is safe so responders can reach you.",
        category: "SCENE_SAFETY",
      },
    ],
  },
  {
    protocolId: "MISSING_PERSON_v1",
    cadNaturePatterns: ["*MISSING*", "*FOUND_PERSON*", "*FOUNDPERSON*", "*LOST_PERSON*", "*LOST_CHILD*"],
    steps: [
      {
        text: "Stay where you are unless the dispatcher asks you to move. Keep this phone on and nearby.",
        category: "COMMUNICATION",
      },
      {
        text: "Write down what they were wearing, where they were last seen, and any medical needs.",
        category: "GENERAL",
      },
      {
        text: "Do not leave the area to search alone if that would put you at risk. Tell us if you see them.",
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
      "BLEED*",
      "PATIENT*",
      "*TRAUMA*",
      "*DIABETIC*",
      "*ALLERG*",
      "*OBSTETRIC*",
      "*PREGNAN*",
      "*CHILDBIRTH*",
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
      {
        text: "If you are safe where you are, stay there. If you are not, move somewhere safer and say so.",
        category: "SCENE_SAFETY",
      },
    ],
  },
];

export const GENERIC_FALLBACK_STEPS: string[] = [
  "You are not alone. Help is on the way.",
  "Keep this phone nearby so we can reach you.",
  "If you are safe where you are, stay there. If you are not, move somewhere safer and tell the dispatcher.",
];
