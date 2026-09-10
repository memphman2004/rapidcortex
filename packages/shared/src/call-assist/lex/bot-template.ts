/**
 * Increment whenever the canonical bot template changes (intents, utterances, slots, locales).
 * A bump enqueues a rolling rebuild of every agency bot. Old aliases keep serving until switched.
 * Format: YYYY-MM-DD.N
 */
export const BOT_TEMPLATE_VERSION = "2026-09-09.1";

export const BOT_TEMPLATE_INTENT_NAMES = [
  "EmergencyEscalation",
  "RequestHuman",
  "NoiseComplaint",
  "SuspiciousPerson",
  "AbandonedVehicle",
  "VehicleBurglary",
  "TheftReport",
  "ParkingComplaint",
  "WelfareCheck",
  "AnimalComplaint",
  "TowComplaint",
  "VandalismDamage",
  "CodeEnforcementComplaint",
  "PublicWorksIssue",
  "TrafficAccidentReportOnly",
  "OnlineReportEligibility",
  "RepeatCallCheck",
  "InformationRequest",
  "Welcome",
  "FallbackIntent",
] as const;

export type BotTemplateIntentName = (typeof BOT_TEMPLATE_INTENT_NAMES)[number];

export type BotTemplateLocaleCopy = {
  en_US: string;
  es_US?: string;
};

export type BotTemplateSlot = {
  slotName: string;
  slotTypeId: string;
  required: boolean;
  elicitationPrompt: BotTemplateLocaleCopy;
};

export type BotTemplateIntent = {
  intentName: string;
  description: string;
  sampleUtterances: {
    en_US: string[];
    es_US?: string[];
  };
  slots: BotTemplateSlot[];
  confirmationPrompt?: BotTemplateLocaleCopy;
};

export type CanonicalBotSpecIntent = {
  name: string;
  utterancesEn: string[];
  utterancesEs?: string[];
  slots?: Array<{
    name: string;
    slotType: string;
    required: boolean;
    promptEn: string;
    promptEs?: string;
  }>;
  confirmationEn?: string;
  confirmationEs?: string;
};

export type CanonicalBotSpec = {
  botName: string;
  locales: string[];
  priority: string[];
  intents: CanonicalBotSpecIntent[];
};

const INTENT_DESCRIPTIONS: Record<string, string> = {
  EmergencyEscalation: "Caller describes a life-threatening situation requiring immediate 911 response",
  RequestHuman: "Caller explicitly requests a human at any point in the conversation",
  NoiseComplaint: "Caller is reporting excessive noise from a neighbor, party, or other source",
  SuspiciousPerson: "Caller reports a person whose behavior or presence is concerning",
  AbandonedVehicle: "Caller reports a vehicle left unattended",
  VehicleBurglary: "Caller reports a break-in or theft from a vehicle",
  TheftReport: "Caller reports stolen property",
  ParkingComplaint: "Caller reports a parking or driveway obstruction",
  WelfareCheck: "Caller requests a welfare check",
  AnimalComplaint: "Caller reports an animal issue",
  TowComplaint: "Caller reports a tow-related complaint",
  VandalismDamage: "Caller reports vandalism or property damage",
  CodeEnforcementComplaint: "Caller reports a code or property-maintenance issue",
  PublicWorksIssue: "Caller reports a public works or city-services issue",
  TrafficAccidentReportOnly: "Caller reports a traffic accident with no injuries (report only)",
  OnlineReportEligibility: "Caller asks whether an incident can be reported online",
  RepeatCallCheck: "Caller is asking about a prior report",
  InformationRequest: "General questions about agency services, hours, or contact numbers",
  Welcome: "Session start — Lambda returns the DynamoDB greeting; no city name lives in the bot",
  FallbackIntent: "Low-confidence or unrecognized speech — transfer to a human",
};

/** Map the machine-readable Lex spec into the provisioner template. Zero agency copy belongs here. */
export function intentsFromCanonicalSpec(spec: CanonicalBotSpec): BotTemplateIntent[] {
  return spec.intents.map((intent) => ({
    intentName: intent.name,
    description: INTENT_DESCRIPTIONS[intent.name] ?? intent.name,
    sampleUtterances: {
      en_US: [...intent.utterancesEn],
      es_US: intent.utterancesEs ? [...intent.utterancesEs] : undefined,
    },
    slots: (intent.slots ?? []).map((slot) => ({
      slotName: slot.name,
      slotTypeId: slot.slotType,
      required: slot.required,
      elicitationPrompt: {
        en_US: slot.promptEn,
        es_US: slot.promptEs,
      },
    })),
    confirmationPrompt: intent.confirmationEn
      ? { en_US: intent.confirmationEn, es_US: intent.confirmationEs }
      : undefined,
  }));
}

export function assertBotTemplateHasNoAgencyCopy(intents: BotTemplateIntent[]): string[] {
  const blob = JSON.stringify(intents);
  const hits: string[] = [];
  for (const needle of ["Kansas City", "KCPD", "kcpd.org", "Troost", "Wornall", "Paseo"]) {
    if (blob.toLowerCase().includes(needle.toLowerCase())) hits.push(needle);
  }
  return hits;
}

export const BOT_TEMPLATE_SLOT_TYPES = [
  {
    slotTypeName: "VehicleColor",
    valueSelectionStrategy: "ORIGINAL_VALUE" as const,
    values: [
      { value: "red", synonyms: ["crimson", "maroon"] },
      { value: "blue", synonyms: ["navy", "dark blue"] },
      { value: "black", synonyms: ["dark", "jet black"] },
      { value: "white", synonyms: ["cream", "off-white"] },
      { value: "silver", synonyms: ["gray", "metallic"] },
      { value: "green", synonyms: ["olive", "forest green"] },
      { value: "gold", synonyms: ["tan", "beige"] },
      { value: "brown", synonyms: ["bronze", "rust"] },
    ],
  },
  {
    slotTypeName: "VehicleType",
    valueSelectionStrategy: "ORIGINAL_VALUE" as const,
    values: [
      { value: "car", synonyms: ["sedan", "coupe"] },
      { value: "truck", synonyms: ["pickup", "pickup truck"] },
      { value: "SUV", synonyms: ["crossover", "van"] },
      { value: "motorcycle", synonyms: ["bike", "moped"] },
    ],
  },
  {
    slotTypeName: "IncidentTimeframe",
    valueSelectionStrategy: "ORIGINAL_VALUE" as const,
    values: [
      { value: "right now", synonyms: ["happening now", "currently"] },
      { value: "just happened", synonyms: ["a few minutes ago", "just now"] },
      { value: "about an hour ago", synonyms: ["earlier today", "this morning"] },
      { value: "yesterday", synonyms: ["last night", "a while ago"] },
    ],
  },
];
