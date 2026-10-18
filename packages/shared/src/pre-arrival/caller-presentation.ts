import { matchCadNaturePattern } from "./mode-policy.js";

export type CallerGuidanceTone = "crime" | "medical" | "fire" | "general";

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
};

const REASON_RULES: ReasonRule[] = [
  {
    tone: "crime",
    reasonLabel: "a robbery or crime in progress",
    patterns: ["*ROBBERY*", "*BURGLAR*", "*THEFT*", "*INVASION*", "211"],
  },
  {
    tone: "crime",
    reasonLabel: "an assault or fight",
    patterns: ["*ASSAULT*", "*FIGHT*", "*WEAPON*", "*STABB*", "*DISTURBANCE*"],
  },
  {
    tone: "fire",
    reasonLabel: "a fire or smoke",
    patterns: ["FIRE*", "STRUCTURE_FIRE", "SMOKE*"],
  },
  {
    tone: "medical",
    reasonLabel: "a cardiac emergency",
    patterns: ["CARDIAC*", "CARDIAC_ARREST", "CHEST_PAIN"],
  },
  {
    tone: "medical",
    reasonLabel: "a choking emergency",
    patterns: ["CHOKING*", "AIRWAY_OBSTRUCTION"],
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
      "SEIZURE*",
      "OVERDOSE*",
      "UNCONSCIOUS*",
      "BLEED*",
      "PATIENT*",
    ],
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
  const tone = rule?.tone ?? "general";
  const reasonLabel = rule?.reasonLabel ?? null;
  const heardLine = reasonLabel
    ? `We heard this is ${reasonLabel}. You did the right thing by calling.`
    : "We heard you. You did the right thing by calling.";

  if (tone === "crime") {
    return {
      tone,
      reasonLabel,
      heardLine,
      headline: "Stay hidden if you can. Help is coming.",
      guidanceTitle: "What to do right now",
      enRoute: "Officers are on the way to you.",
      arrived: "Officers are at the scene. Stay where you are until they reach you.",
      dispatched: "Your call is in. Officers are being sent.",
      footer: "Do not take photos or make noise if that would put you in view of anyone threatening you.",
    };
  }
  if (tone === "fire") {
    return {
      tone,
      reasonLabel,
      heardLine,
      headline: "Get to safety. Help is on the way.",
      guidanceTitle: "While you wait outside",
      enRoute: "Fire crews are on the way.",
      arrived: "Fire crews are on scene.",
      dispatched: "Fire crews have been dispatched.",
      footer: "Do not go back inside for belongings or pets unless a firefighter tells you it is safe.",
    };
  }
  if (tone === "medical") {
    return {
      tone,
      reasonLabel,
      heardLine,
      headline: "Help is on the way.",
      guidanceTitle: "While you wait with them",
      enRoute: "Medical responders are on the way.",
      arrived: "Medical responders are on scene.",
      dispatched: "Medical responders have been dispatched.",
      footer: "If you can safely share photos, use the media link your dispatcher sends separately.",
    };
  }
  return {
    tone,
    reasonLabel,
    heardLine,
    headline: "Help is on the way.",
    guidanceTitle: "While you wait",
    enRoute: "Responders are on the way.",
    arrived: "Responders are on scene.",
    dispatched: "Responders have been dispatched.",
    footer: "If anything changes and you can speak safely, tell the person on the phone.",
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
  { id: "medical", label: "Medical emergency", code: "MEDICAL" },
  { id: "cardiac", label: "Not breathing / CPR", code: "CARDIAC_ARREST" },
  { id: "choking", label: "Choking", code: "CHOKING" },
  { id: "fire", label: "Fire or smoke", code: "FIRE" },
] as const;
