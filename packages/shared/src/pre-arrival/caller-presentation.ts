import { matchCadNaturePattern } from "./mode-policy.js";

export type CallerGuidanceTone = "crime" | "medical" | "fire" | "evacuate" | "crash" | "general";

export type CallerGuidancePresentation = {
  tone: CallerGuidanceTone;
  /** Plain reason the caller can recognize. Empty when nature is unknown. */
  reasonLabel: string | null;
  /** First line: they were heard. */
  heardLine: string;
  headline: string;
  guidanceTitle: string;
  enRoute: string;
  arrived: string;
  dispatched: string;
  footer: string;
};

type ReasonRule = {
  patterns: string[];
  tone: CallerGuidanceTone;
  reasonLabel: string;
  headline: string;
  guidanceTitle: string;
  enRoute: string;
  arrived: string;
  dispatched: string;
  footer: string;
};

const REASON_RULES: ReasonRule[] = [
  {
    tone: "crime",
    reasonLabel: "a robbery or crime in progress",
    patterns: ["*ROBBERY*", "*BURGLAR*", "*THEFT*", "*INVASION*", "211"],
    headline: "Stay hidden if you can. Help is coming.",
    guidanceTitle: "What to do right now",
    enRoute: "Officers are on the way to you.",
    arrived: "Officers are at the scene. Stay where you are until they reach you.",
    dispatched: "Your call is in. Officers are being sent.",
    footer: "Do not take photos or make noise if that would put you in view of anyone threatening you.",
  },
  {
    tone: "crime",
    reasonLabel: "an assault or fight",
    patterns: ["*ASSAULT*", "*FIGHT*", "*WEAPON*", "*STABB*", "*DISTURBANCE*"],
    headline: "Stay safe if you can. Help is coming.",
    guidanceTitle: "What to do right now",
    enRoute: "Officers are on the way to you.",
    arrived: "Officers are at the scene. Stay where you are until they reach you.",
    dispatched: "Your call is in. Officers are being sent.",
    footer: "Do not confront anyone. Keep this phone with you if you can do it safely.",
  },
  {
    tone: "crash",
    reasonLabel: "a vehicle crash",
    patterns: [
      "*CRASH*",
      "*MVC*",
      "*MVA*",
      "*COLLISION*",
      "*HIT_AND_RUN*",
      "*HITANDRUN*",
      "*TRAFFIC_ACCIDENT*",
      "*VEHICLE_ACCIDENT*",
    ],
    headline: "Stay out of traffic if you can. Help is on the way.",
    guidanceTitle: "While you wait at the scene",
    enRoute: "Responders are on the way to the crash.",
    arrived: "Responders are on scene.",
    dispatched: "Responders have been dispatched to the crash.",
    footer: "If anyone’s condition changes, tell the person on the phone right away.",
  },
  {
    tone: "evacuate",
    reasonLabel: "a gas, carbon monoxide, or hazardous situation",
    patterns: [
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
      "*WATER_RESCUE*",
      "*DROWN*",
    ],
    headline: "Get to safety. Do not go back in.",
    guidanceTitle: "While you wait outside",
    enRoute: "Responders are on the way.",
    arrived: "Responders are on scene.",
    dispatched: "Responders have been dispatched.",
    footer: "Do not re-enter for belongings or pets unless a responder tells you it is safe.",
  },
  {
    tone: "fire",
    reasonLabel: "a fire or smoke",
    patterns: ["FIRE*", "STRUCTURE_FIRE", "SMOKE*", "*WILDLAND*", "*BRUSH*"],
    headline: "Get to safety. Help is on the way.",
    guidanceTitle: "While you wait outside",
    enRoute: "Fire crews are on the way.",
    arrived: "Fire crews are on scene.",
    dispatched: "Fire crews have been dispatched.",
    footer: "Do not go back inside for belongings or pets unless a firefighter tells you it is safe.",
  },
  {
    tone: "medical",
    reasonLabel: "a cardiac emergency",
    patterns: ["CARDIAC*", "CARDIAC_ARREST", "CHEST_PAIN"],
    headline: "Help is on the way.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "If you can safely share photos, use the media link your dispatcher sends separately.",
  },
  {
    tone: "medical",
    reasonLabel: "a choking emergency",
    patterns: ["CHOKING*", "AIRWAY_OBSTRUCTION"],
    headline: "Help is on the way — stay on the line.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "Follow the person on the phone. Tell them right away if breathing stops.",
  },
  {
    tone: "medical",
    reasonLabel: "a possible overdose",
    patterns: ["*OVERDOSE*", "*OD_*", "OD", "*NARCAN*", "*OPIOID*"],
    headline: "Stay with them. Help is on the way.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "Do not leave them alone. Tell the dispatcher if breathing slows or stops.",
  },
  {
    tone: "medical",
    reasonLabel: "a possible stroke",
    patterns: ["*STROKE*", "*CVA*", "*TIA*"],
    headline: "Help is on the way. Note the time they were last normal.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "Do not give food, drink, or medicine unless the dispatcher tells you to.",
  },
  {
    tone: "medical",
    reasonLabel: "someone who is unconscious",
    patterns: ["*UNCONSCIOUS*", "*UNRESPONSIVE*", "*PASSED_OUT*", "*SYNCOPE*"],
    headline: "Stay with them. Help is on the way.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "Tell the dispatcher right away if they stop breathing or you cannot wake them.",
  },
  {
    tone: "medical",
    reasonLabel: "a breathing problem",
    patterns: [
      "*RESPIRATORY*",
      "*BREATHING*",
      "*SHORTNESS*",
      "*DIFFICULTY_BREATH*",
      "*ASTHMA*",
      "*COPD*",
    ],
    headline: "Help is on the way. Help them sit upright if they can.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "Tell the dispatcher if breathing gets worse.",
  },
  {
    tone: "medical",
    reasonLabel: "a seizure",
    patterns: ["*SEIZURE*", "*CONVULSION*", "*EPILEP*"],
    headline: "Stay with them. Help is on the way.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "Do not put anything in their mouth. Tell the dispatcher when the seizure stops.",
  },
  {
    tone: "general",
    reasonLabel: "a welfare check",
    patterns: ["*WELFARE*", "*WELLNESS*", "*CHECK_WELL*", "*WELL_BEING*"],
    headline: "You are not alone. Help is on the way.",
    guidanceTitle: "While you wait",
    enRoute: "Responders are on the way.",
    arrived: "Responders are on scene.",
    dispatched: "Responders have been dispatched.",
    footer: "If anything changes and you can speak safely, tell the person on the phone.",
  },
  {
    tone: "general",
    reasonLabel: "a missing person",
    patterns: ["*MISSING*", "*FOUND_PERSON*", "*FOUNDPERSON*", "*LOST_PERSON*", "*LOST_CHILD*"],
    headline: "Stay where you are unless asked to move. Help is coordinating.",
    guidanceTitle: "While you wait",
    enRoute: "Responders are on the way.",
    arrived: "Responders are on scene.",
    dispatched: "Responders have been dispatched.",
    footer: "Keep this phone on. Tell us immediately if you see them.",
  },
  {
    tone: "medical",
    reasonLabel: "a medical emergency",
    patterns: [
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
    headline: "Help is on the way.",
    guidanceTitle: "While you wait with them",
    enRoute: "Medical responders are on the way.",
    arrived: "Medical responders are on scene.",
    dispatched: "Medical responders have been dispatched.",
    footer: "If you can safely share photos, use the media link your dispatcher sends separately.",
  },
];

function matchRule(natureCode: string): ReasonRule | null {
  const code = natureCode.trim();
  if (!code || code.toUpperCase() === "UNKNOWN") return null;
  for (const rule of REASON_RULES) {
    if (rule.patterns.some((pattern) => matchCadNaturePattern(code, pattern))) return rule;
  }
  return null;
}

/** Caller-facing copy from CAD nature. Does not expose raw nature codes. */
export function callerGuidancePresentation(cadNatureCode: string | null | undefined): CallerGuidancePresentation {
  const rule = matchRule(cadNatureCode ?? "");
  if (!rule) {
    return {
      tone: "general",
      reasonLabel: null,
      heardLine: "We heard you. You did the right thing by calling.",
      headline: "Help is on the way.",
      guidanceTitle: "While you wait",
      enRoute: "Responders are on the way.",
      arrived: "Responders are on scene.",
      dispatched: "Responders have been dispatched.",
      footer: "If anything changes and you can speak safely, tell the person on the phone.",
    };
  }
  return {
    tone: rule.tone,
    reasonLabel: rule.reasonLabel,
    heardLine: `We heard this is ${rule.reasonLabel}. You did the right thing by calling.`,
    headline: rule.headline,
    guidanceTitle: rule.guidanceTitle,
    enRoute: rule.enRoute,
    arrived: rule.arrived,
    dispatched: rule.dispatched,
    footer: rule.footer,
  };
}

/** True when the dispatcher has not chosen a caller-facing reason. */
export function isPreArrivalReasonMissing(cadNatureCode: string | null | undefined): boolean {
  const code = (cadNatureCode ?? "").trim();
  return !code || code.toUpperCase() === "UNKNOWN";
}

/** Dispatcher preview labels — plain language, not a raw CAD token. */
export const PRE_ARRIVAL_REASON_PRESETS = [
  { id: "incident", label: "Use the incident’s nature", code: "" },
  { id: "robbery", label: "Robbery or crime in progress", code: "ROBBERY" },
  { id: "assault", label: "Assault or fight", code: "ASSAULT" },
  { id: "crash", label: "Vehicle crash / injury", code: "MVC" },
  { id: "overdose", label: "Overdose", code: "OVERDOSE" },
  { id: "stroke", label: "Stroke", code: "STROKE" },
  { id: "unconscious", label: "Unconscious / not responsive", code: "UNCONSCIOUS" },
  { id: "breathing", label: "Breathing problem", code: "RESPIRATORY" },
  { id: "seizure", label: "Seizure", code: "SEIZURE" },
  { id: "hazmat", label: "Gas / CO / hazmat — evacuate", code: "HAZMAT" },
  { id: "welfare", label: "Welfare check", code: "WELFARE_CHECK" },
  { id: "missing", label: "Missing person", code: "MISSING_PERSON" },
  { id: "medical", label: "Medical emergency", code: "MEDICAL" },
  { id: "cardiac", label: "Not breathing / CPR", code: "CARDIAC_ARREST" },
  { id: "choking", label: "Choking", code: "CHOKING" },
  { id: "fire", label: "Fire or smoke", code: "FIRE" },
] as const;
