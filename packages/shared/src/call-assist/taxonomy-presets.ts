import {
  cloneAgencyTaxonomy,
  unknownCallType,
  type AgencyTaxonomy,
  type CallAssistDemoScenarioConfig,
  type CallAssistExternalTransferEntry,
  type CallAssistTaxonomyVertical,
  type CallType,
  type IntakeField,
  type IntakeTemplate,
} from "./taxonomy.js";

function fields(rows: IntakeField[]): IntakeField[] {
  return rows;
}

function tpl(id: string, label: string, fieldRows: IntakeField[]): IntakeTemplate {
  return { id, label, fields: fields(fieldRows) };
}

type TypeSeed = Omit<CallType, "vertical" | "intakeTemplateId" | "followUpQuestions" | "enabled" | "cadNatureCode"> & {
  cadNatureCode?: string | null;
  followUpQuestions?: CallType["followUpQuestions"];
  enabled?: boolean;
};

function types(vertical: CallAssistTaxonomyVertical, intakeTemplateId: string, seeds: TypeSeed[]): CallType[] {
  return seeds.map((seed) => ({
    followUpQuestions: [],
    enabled: true,
    ...seed,
    cadNatureCode: seed.cadNatureCode ?? null,
    vertical: [vertical],
    intakeTemplateId,
  }));
}

const INTAKE_911 = tpl("intake_911_standard", "Standard municipal intake", [
  { id: "incidentType", label: "Incident type", type: "text", required: true },
  { id: "location", label: "Location / address", type: "text", required: true },
  { id: "crossStreets", label: "Cross streets", type: "text", required: false },
  { id: "aptBusiness", label: "Apt / business name", type: "text", required: false },
  { id: "directionTravel", label: "Direction of travel", type: "text", required: false },
  { id: "vehicleMake", label: "Vehicle make / color", type: "text", required: false },
  { id: "licensePlate", label: "License plate", type: "text", required: false },
  { id: "suspectDesc", label: "Suspect description", type: "text", required: false },
  { id: "weapons", label: "Weapons present", type: "boolean", required: false, alertOnValue: "true" },
  { id: "injuries", label: "Injuries", type: "boolean", required: false, alertOnValue: "true" },
  { id: "callerName", label: "Caller name", type: "text", required: false },
  { id: "callbackNumber", label: "Callback number", type: "text", required: false },
  { id: "preferredLang", label: "Preferred language", type: "text", required: false },
]);

const INTAKE_CAMPUS = tpl("intake_campus_standard", "Standard campus intake", [
  { id: "concernType", label: "Concern type", type: "text", required: true },
  { id: "building", label: "Building", type: "text", required: true },
  { id: "room", label: "Room / area", type: "text", required: false },
  { id: "callerName", label: "Name", type: "text", required: false },
  {
    id: "studentStatus",
    label: "Student / staff / visitor",
    type: "select",
    required: false,
    options: ["Student", "Staff", "Faculty", "Visitor", "Unknown"],
  },
  { id: "medicalNeeded", label: "Medical attention needed", type: "boolean", required: false, alertOnValue: "true" },
  { id: "bystanders", label: "Others present", type: "text", required: false },
  { id: "counselingFlag", label: "Counseling referral", type: "boolean", required: false },
  { id: "callbackNumber", label: "Callback number", type: "text", required: false },
  { id: "preferredLang", label: "Preferred language", type: "text", required: false },
]);

const INTAKE_VENUE = tpl("intake_venue_standard", "Standard venue intake", [
  { id: "reportType", label: "Report type", type: "text", required: true },
  { id: "section", label: "Section", type: "text", required: true },
  { id: "rowSeat", label: "Row / seat", type: "text", required: false },
  { id: "level", label: "Level / concourse", type: "text", required: false },
  { id: "description", label: "Description", type: "text", required: false },
  { id: "medicalNeeded", label: "Medical needed", type: "boolean", required: false, alertOnValue: "true" },
  { id: "bystanders", label: "Others on scene", type: "text", required: false },
  { id: "adaFlag", label: "ADA accommodation", type: "boolean", required: false },
  { id: "guestContact", label: "Guest contact / callback", type: "text", required: false },
  { id: "preferredLang", label: "Preferred language", type: "text", required: false },
]);

/** Replaces the hardcoded 13-type array. IDs match CALL_TRIAGE_CLASSIFICATIONS exactly. */
export const PRESET_911: AgencyTaxonomy = {
  vertical: "911",
  defaultIntakeTemplateId: INTAKE_911.id,
  intakeTemplates: [INTAKE_911],
  callTypes: types("911", INTAKE_911.id, [
    {
      id: "EMERGENCY",
      label: "Emergency",
      cadNatureCode: "EMRG",
      defaultPriority: 1,
      escalationPath: "emergency",
      isEmergency: true,
      sortOrder: 0,
      classifierKeywords: ["emergency", "fire", "shooting", "stabbing", "unconscious", "not breathing"],
    },
    {
      id: "NON_EMERGENCY_POLICE",
      label: "Non-emergency police",
      cadNatureCode: "NEPLC",
      defaultPriority: 2,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 1,
      classifierKeywords: [
        "suspicious",
        "disturbance",
        "theft",
        "vandalism",
        "trespass",
        "abandoned vehicle",
        "welfare",
        "welfare check",
        "elderly neighbor",
        "worried about",
        "carro abandonado",
        "vehiculo abandonado",
        "vehículo abandonado",
      ],
    },
    {
      id: "ANIMAL_CONTROL",
      label: "Animal control",
      cadNatureCode: "ANIMAL",
      defaultPriority: 3,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 2,
      classifierKeywords: ["animal", "dog", "stray", "loose", "bite", "raccoon", "animal control"],
    },
    {
      id: "PARKING",
      label: "Parking complaint",
      cadNatureCode: "PRK",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 3,
      classifierKeywords: ["parking", "parked", "fire hydrant", "blocking", "no parking", "driveway", "hydrant"],
    },
    {
      id: "CODE_ENFORCEMENT",
      label: "Code enforcement",
      cadNatureCode: "CODE",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 4,
      classifierKeywords: ["code", "violation", "junk", "grass", "illegal dumping", "overgrown"],
    },
    {
      id: "PUBLIC_WORKS",
      label: "Public works",
      cadNatureCode: "PW",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 5,
      classifierKeywords: ["pothole", "streetlight", "street light", "water main", "sewer", "public works", "burst pipe", "traffic light"],
    },
    {
      id: "TOW_COMPLAINT",
      label: "Tow complaint",
      cadNatureCode: "TOW",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 6,
      classifierKeywords: ["tow", "impound", "towed"],
    },
    {
      id: "NOISE_COMPLAINT",
      label: "Noise complaint",
      cadNatureCode: "NOISE",
      defaultPriority: 3,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 7,
      classifierKeywords: ["noise", "loud", "music", "party", "neighbor", "barking", "ruido", "musica alta", "música alta"],
    },
    {
      id: "REPORT_ONLY",
      label: "Report only",
      cadNatureCode: "RPT",
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 8,
      classifierKeywords: ["report", "file a report", "want to report", "happened yesterday", "happened last night"],
    },
    {
      id: "INFORMATION_REQUEST",
      label: "Information request",
      cadNatureCode: null,
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 9,
      classifierKeywords: ["information", "hours", "address", "phone", "contact", "hours of operation", "how do i file"],
    },
    {
      id: "CARFAX_REPORTING_ELIGIBLE",
      label: "CarFax eligible",
      cadNatureCode: null,
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 10,
      classifierKeywords: [
        "carfax",
        "accident report",
        "insurance",
        "stolen car",
        "stolen vehicle",
        "fender bender",
        "report for insurance",
      ],
    },
    {
      id: "ONLINE_REPORTING_ELIGIBLE",
      label: "Online reporting",
      cadNatureCode: null,
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 11,
      classifierKeywords: ["online", "website", "portal", "self-report"],
    },
    {
      id: "UNKNOWN",
      label: "Unknown",
      cadNatureCode: null,
      defaultPriority: 3,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 12,
      classifierKeywords: [],
    },
  ]),
};

export const PRESET_CAMPUS: AgencyTaxonomy = {
  vertical: "campus",
  defaultIntakeTemplateId: INTAKE_CAMPUS.id,
  intakeTemplates: [INTAKE_CAMPUS],
  callTypes: types("campus", INTAKE_CAMPUS.id, [
    {
      id: "emergency",
      label: "Emergency",
      defaultPriority: 1,
      escalationPath: "emergency",
      isEmergency: true,
      sortOrder: 0,
      classifierKeywords: ["emergency", "fire", "weapon", "assault", "unconscious", "not breathing"],
    },
    {
      id: "wellness_check",
      label: "Wellness check",
      defaultPriority: 2,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 1,
      classifierKeywords: ["wellness", "check on", "concerned about", "not responding", "welfare"],
    },
    {
      id: "medical_request",
      label: "Medical request",
      defaultPriority: 1,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 2,
      classifierKeywords: ["medical", "injured", "hurt", "sick", "fell", "fainted"],
    },
    {
      id: "title_ix",
      label: "Title IX routing",
      defaultPriority: 2,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 3,
      classifierKeywords: ["sexual", "harassment", "title IX", "title ix", "discrimination"],
    },
    {
      id: "counseling",
      label: "Counseling referral",
      defaultPriority: 2,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 4,
      classifierKeywords: ["mental health", "counseling", "depressed", "anxious", "crisis", "harm"],
    },
    {
      id: "noise_complaint",
      label: "Noise complaint",
      defaultPriority: 3,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 5,
      classifierKeywords: ["noise", "loud", "party", "music", "disturbance"],
    },
    {
      id: "facilities_issue",
      label: "Facilities issue",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 6,
      classifierKeywords: ["facilities", "maintenance", "broken", "leak", "heat", "AC", "elevator"],
    },
    {
      id: "blue_phone",
      label: "Blue phone relay",
      defaultPriority: 2,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 7,
      classifierKeywords: ["blue phone", "emergency phone", "call box"],
    },
    {
      id: "ada_accommodation",
      label: "ADA accommodation",
      defaultPriority: 3,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 8,
      classifierKeywords: ["ADA", "disability", "accommodation", "wheelchair", "accessibility"],
    },
    {
      id: "lost_found",
      label: "Lost / found",
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 9,
      classifierKeywords: ["lost", "found", "missing", "wallet", "keys", "bag"],
    },
    {
      id: "info_request",
      label: "Information request",
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 10,
      classifierKeywords: ["hours", "location", "directions", "office", "contact"],
    },
    unknownCallType("campus", INTAKE_CAMPUS.id),
  ]),
};

export const PRESET_VENUE: AgencyTaxonomy = {
  vertical: "venue",
  defaultIntakeTemplateId: INTAKE_VENUE.id,
  intakeTemplates: [INTAKE_VENUE],
  callTypes: types("venue", INTAKE_VENUE.id, [
    {
      id: "emergency",
      label: "Emergency",
      defaultPriority: 1,
      escalationPath: "emergency",
      isEmergency: true,
      sortOrder: 0,
      classifierKeywords: ["emergency", "fire", "weapon", "fight", "unconscious", "not breathing"],
    },
    {
      id: "medical",
      label: "Medical assistance",
      defaultPriority: 1,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 1,
      classifierKeywords: ["medical", "injured", "hurt", "fell", "fainted", "sick", "unresponsive"],
    },
    {
      id: "security",
      label: "Security incident",
      defaultPriority: 2,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 2,
      classifierKeywords: ["fight", "threatening", "aggressive", "weapon", "security"],
    },
    {
      id: "lost_person",
      label: "Lost person",
      defaultPriority: 2,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 3,
      classifierKeywords: ["lost", "missing", "child", "can't find", "separated"],
    },
    {
      id: "ada_accommodation",
      label: "ADA accommodation",
      defaultPriority: 2,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 4,
      classifierKeywords: ["ADA", "wheelchair", "accessibility", "disability", "accommodation"],
    },
    {
      id: "noise_complaint",
      label: "Noise / disruptive",
      defaultPriority: 3,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 5,
      classifierKeywords: ["noise", "loud", "disruptive", "rowdy", "yelling", "drunk"],
    },
    {
      id: "crowd_concern",
      label: "Crowd concern",
      defaultPriority: 2,
      escalationPath: "dispatcher",
      isEmergency: false,
      sortOrder: 6,
      classifierKeywords: ["crowd", "crush", "surge", "bottleneck", "too many people"],
    },
    {
      id: "guest_services",
      label: "Guest services",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 7,
      classifierKeywords: ["guest services", "complaint", "ticket", "refund", "experience"],
    },
    {
      id: "facilities_issue",
      label: "Facilities issue",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 8,
      classifierKeywords: ["bathroom", "concession", "seat broken", "elevator", "facilities"],
    },
    {
      id: "lost_item",
      label: "Lost item",
      defaultPriority: 4,
      escalationPath: "external",
      isEmergency: false,
      sortOrder: 9,
      classifierKeywords: ["lost item", "lost phone", "wallet", "bag", "belongs"],
    },
    {
      id: "info_request",
      label: "Event information",
      defaultPriority: 4,
      escalationPath: "self_service",
      isEmergency: false,
      sortOrder: 10,
      classifierKeywords: ["schedule", "time", "parking", "gate", "entry", "when does"],
    },
    unknownCallType("venue", INTAKE_VENUE.id),
  ]),
};

PRESET_CAMPUS.callTypes = PRESET_CAMPUS.callTypes.map((t, i) => ({ ...t, sortOrder: t.id === "unknown" ? 11 : i }));
PRESET_VENUE.callTypes = PRESET_VENUE.callTypes.map((t, i) => ({ ...t, sortOrder: t.id === "unknown" ? 11 : i }));

export const TAXONOMY_PRESETS: Record<CallAssistTaxonomyVertical, AgencyTaxonomy> = {
  "911": PRESET_911,
  campus: PRESET_CAMPUS,
  venue: PRESET_VENUE,
};

export function presetTaxonomy(vertical: CallAssistTaxonomyVertical | string | null | undefined): AgencyTaxonomy {
  const key = vertical === "campus" || vertical === "venue" ? vertical : "911";
  return cloneAgencyTaxonomy(TAXONOMY_PRESETS[key]);
}

export type CallAssistTaxonomyConfigSlice = {
  taxonomy?: AgencyTaxonomy | null;
  vertical?: CallAssistTaxonomyVertical | string | null;
  uiVertical?: CallAssistTaxonomyVertical | string | null;
};

/**
 * Agencies with no stored taxonomy fall back to the vertical preset.
 * The preset is never written to DynamoDB unless the agency customizes it.
 */
export function resolveAgencyTaxonomy(config: CallAssistTaxonomyConfigSlice): AgencyTaxonomy {
  const vertical =
    config.taxonomy?.vertical ??
    (config.vertical === "campus" || config.vertical === "venue" || config.vertical === "911"
      ? config.vertical
      : config.uiVertical === "campus" || config.uiVertical === "venue" || config.uiVertical === "911"
        ? config.uiVertical
        : "911");
  const base = config.taxonomy ? cloneAgencyTaxonomy(config.taxonomy) : presetTaxonomy(vertical);
  const expectedUnknown = vertical === "911" ? "UNKNOWN" : "unknown";
  if (!base.callTypes.some((t) => t.id === expectedUnknown || t.id.toLowerCase() === "unknown")) {
    base.callTypes.push(unknownCallType(base.vertical, base.defaultIntakeTemplateId));
  } else {
    for (const t of base.callTypes) {
      if (t.id === expectedUnknown || t.id.toLowerCase() === "unknown") t.enabled = true;
    }
  }
  return base;
}

export function transferDirectoryPreset(vertical: CallAssistTaxonomyVertical): CallAssistExternalTransferEntry[] {
  if (vertical === "campus") {
    return [
      { id: "campus-police", name: "Campus Police", number: "Ext. 2911", warmTransferScript: "I'm transferring you to Campus Police now." },
      { id: "student-health", name: "Student Health", number: "Ext. 2200", warmTransferScript: "I'm transferring you to Student Health now." },
      { id: "res-life", name: "Residential Life", number: "Ext. 2300", warmTransferScript: "I'm transferring you to Residential Life now." },
      { id: "title-ix", name: "Title IX Office", number: "Ext. 2400", warmTransferScript: "I'm transferring you to the Title IX Office now." },
      { id: "counseling", name: "Counseling Center", number: "Ext. 2500", warmTransferScript: "I'm transferring you to the Counseling Center now." },
    ];
  }
  if (vertical === "venue") {
    return [
      { id: "security-ops", name: "Security Operations", number: "Ext. 200", warmTransferScript: "I'm transferring you to Security Operations now." },
      { id: "medical-team", name: "Medical Team", number: "Ext. 300", warmTransferScript: "I'm transferring you to the medical team now." },
      { id: "guest-services", name: "Guest Services", number: "Ext. 100", warmTransferScript: "I'm transferring you to Guest Services now." },
      { id: "ada", name: "ADA Coordinator", number: "Ext. 150", warmTransferScript: "I'm transferring you to the ADA coordinator now." },
    ];
  }
  return [
    { id: "city-311", name: "311 — City Services", number: "311", warmTransferScript: "I'm transferring you to 311 now." },
    { id: "parks", name: "Parks Department", number: "Ext. 4100", warmTransferScript: "I'm transferring you to Parks now." },
    { id: "water", name: "Water Department", number: "Ext. 4200", warmTransferScript: "I'm transferring you to the water department now." },
  ];
}

export const DEFAULT_DISCLOSURE_BY_VERTICAL: Record<CallAssistTaxonomyVertical, string> = {
  "911":
    "You are speaking with an AI assistant for {agencyShortName}. If this is an emergency, say emergency or hang up and dial 9-1-1.",
  campus: "You are speaking with an AI assistant for {agencyShortName} Campus Safety.",
  venue: "You are speaking with an AI assistant for {agencyShortName}.",
};

export function defaultRetentionForVertical(vertical: CallAssistTaxonomyVertical): {
  policyName: string;
  audioRetentionDays: number;
  transcriptRetentionDays: number;
  governingLaw: string | null;
} {
  if (vertical === "911") {
    return {
      policyName: "",
      audioRetentionDays: 90,
      transcriptRetentionDays: 365,
      governingLaw: null,
    };
  }
  return {
    policyName: "",
    audioRetentionDays: 30,
    transcriptRetentionDays: 90,
    governingLaw: null,
  };
}

export type CallAssistCadWizardOption = {
  id: string;
  label: string;
  cadProviderId: "mock" | "motorola-premierone" | "tyler-new-world" | "mark43" | "hexagon-intergraph" | "versaterm";
  cadProviderLabel: string | null;
};

export const CALL_ASSIST_CAD_WIZARD_OPTIONS: readonly CallAssistCadWizardOption[] = [
  { id: "motorola-premierone", label: "Motorola PremierOne", cadProviderId: "motorola-premierone", cadProviderLabel: "PremierOne" },
  { id: "tritech-inform", label: "TriTech Inform", cadProviderId: "mock", cadProviderLabel: "TriTech Inform" },
  { id: "mark43", label: "Mark43", cadProviderId: "mark43", cadProviderLabel: "Mark43" },
  { id: "centralsquare", label: "CentralSquare", cadProviderId: "mock", cadProviderLabel: "CentralSquare" },
  { id: "tyler-new-world", label: "Tyler Technologies", cadProviderId: "tyler-new-world", cadProviderLabel: "New World CAD" },
  { id: "other", label: "Other", cadProviderId: "mock", cadProviderLabel: "CAD" },
  { id: "none", label: "No CAD system", cadProviderId: "mock", cadProviderLabel: null },
];

export function cadWizardSelection(
  cadProviderId: string | null | undefined,
  cadProviderLabel: string | null | undefined,
): CallAssistCadWizardOption {
  if (!cadProviderLabel && (cadProviderId === "mock" || !cadProviderId)) {
    return CALL_ASSIST_CAD_WIZARD_OPTIONS.find((o) => o.id === "none")!;
  }
  const byId = CALL_ASSIST_CAD_WIZARD_OPTIONS.find((o) => o.cadProviderId === cadProviderId && o.id !== "none" && o.id !== "other");
  if (byId) return byId;
  const byLabel = CALL_ASSIST_CAD_WIZARD_OPTIONS.find((o) => o.cadProviderLabel === cadProviderLabel);
  if (byLabel) return byLabel;
  return {
    id: "other",
    label: "Other",
    cadProviderId: "mock",
    cadProviderLabel: cadProviderLabel ?? "CAD",
  };
}

function demo(
  id: string,
  label: string,
  vertical: CallAssistTaxonomyVertical,
  expectedClass: string,
  utterances: string[],
): CallAssistDemoScenarioConfig {
  return { id, label, vertical, expectedClass, utterances, source: "preset", enabled: true };
}

export const CAMPUS_DEMO_SCENARIO_PRESETS: CallAssistDemoScenarioConfig[] = [
  demo("campus-wellness", "Wellness check", "campus", "wellness_check", [
    "Can you do a wellness check on my roommate in Myers Hall room 204? She is not responding to texts.",
  ]),
  demo("campus-noise", "Noise in dorm", "campus", "noise_complaint", [
    "There's a loud party on the third floor of Myers Hall. Music has been going since midnight.",
  ]),
  demo("campus-medical", "Student medical emergency", "campus", "medical_request", [
    "A student fell on the library steps and is hurt. They are awake. Myers Hall courtyard.",
  ]),
  demo("campus-title-ix", "Title IX routing", "campus", "title_ix", [
    "I need to report harassment. Can you connect me with Title IX?",
  ]),
  demo("campus-facilities", "Facilities issue", "campus", "facilities_issue", [
    "The elevator in Myers Hall is broken and there is a leak on the second floor.",
  ]),
  demo("campus-lost-id", "Lost student ID", "campus", "lost_found", [
    "I lost my student ID wallet near the student union. Can I file a lost item report?",
  ]),
  demo("campus-directions", "Directions request", "campus", "info_request", [
    "What are the hours for the registrar office and how do I get there?",
  ]),
  demo("campus-escalate", "Caller who escalates to emergency mid-call", "campus", "emergency", [
    "I think my roommate is just sleeping it off in Myers Hall.",
    "Wait — she is not breathing",
  ]),
  demo("campus-language", "International student language", "campus", "info_request", [
    "Hola, where is the international student office and what are the hours?",
  ]),
  demo("campus-counseling", "Counseling referral", "campus", "counseling", [
    "I am anxious and want a counseling referral for a student in crisis. Not an emergency.",
  ]),
];

export const VENUE_DEMO_SCENARIO_PRESETS: CallAssistDemoScenarioConfig[] = [
  demo("venue-medical", "Medical in section", "venue", "medical", [
    "A guest fainted in section 114 row J. They are breathing. We need medical.",
  ]),
  demo("venue-lost-child", "Lost child", "venue", "lost_person", [
    "I can't find my child. We were in section 114 and got separated.",
  ]),
  demo("venue-ada", "ADA request", "venue", "ada_accommodation", [
    "We need a wheelchair accessible seat and an ADA accommodation in section 8.",
  ]),
  demo("venue-noise", "Noise complaint", "venue", "noise_complaint", [
    "Guests in section 114 are loud and disruptive, yelling and drunk.",
  ]),
  demo("venue-security", "Security incident", "venue", "security", [
    "Two guests are fighting in the concourse near section 114. Security needed.",
  ]),
  demo("venue-crowd", "Crowd concern", "venue", "crowd_concern", [
    "There is a crowd surge at gate B, too many people in the bottleneck.",
  ]),
  demo("venue-guest", "Guest services complaint", "venue", "guest_services", [
    "I want a ticket refund. Guest services complaint about the experience.",
  ]),
  demo("venue-lost-item", "Lost item", "venue", "lost_item", [
    "I lost my phone and wallet in section 114. Lost item report.",
  ]),
  demo("venue-info", "Event information request", "venue", "info_request", [
    "When does the event start and which gate is parking entry?",
  ]),
  demo("venue-escalate", "Caller who escalates to emergency mid-call", "venue", "emergency", [
    "Someone spilled a drink in section 114.",
    "Now he is unconscious and not breathing",
  ]),
];

export function demoScenarioPresetsForVertical(vertical: CallAssistTaxonomyVertical): CallAssistDemoScenarioConfig[] {
  if (vertical === "campus") return CAMPUS_DEMO_SCENARIO_PRESETS.map((s) => ({ ...s, utterances: [...s.utterances] }));
  if (vertical === "venue") return VENUE_DEMO_SCENARIO_PRESETS.map((s) => ({ ...s, utterances: [...s.utterances] }));
  return [];
}

export const PRESET_911_TYPE_IDS = PRESET_911.callTypes.map((t) => t.id);
