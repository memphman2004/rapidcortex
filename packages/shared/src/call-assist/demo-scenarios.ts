import type { CallTriageClassification } from "./classifications.js";
import { interpolateDemoUtterance, type AgencyDemoCustomizations } from "./voice-config.js";

export type DemoUtterance = {
  sequence: number;
  text: string;
  delayAfterPreviousMs: number;
  injectEmergencyKeyword?: boolean;
};

export type DemoEvaluationCriterion = {
  id: string;
  description: string;
};

export type CallAssistDemoScenario = {
  id: string;
  libraryId: string;
  name: string;
  description: string;
  callerUtterances: DemoUtterance[];
  expectedTriageClassification: CallTriageClassification;
  expectedTransferTrigger: "EMERGENCY" | "HUMAN_REQUESTED" | "EXTERNAL_AGENCY" | "NONE";
  evaluationCriteria: DemoEvaluationCriterion[];
};

export type DemoScenarioTemplate = Omit<CallAssistDemoScenario, "libraryId"> & {
  templateId: string;
};

const BASE_LIBRARY_ID = "call-assist-base";
const KCPD_LIBRARY_ID = "kcpd-rfp-2026";

function cloneScenario(s: CallAssistDemoScenario): CallAssistDemoScenario {
  return {
    ...s,
    callerUtterances: s.callerUtterances.map((u) => ({ ...u })),
    evaluationCriteria: s.evaluationCriteria.map((c) => ({ ...c })),
  };
}

function scenarioFromTemplate(
  template: DemoScenarioTemplate,
  libraryId: string,
  customizations: AgencyDemoCustomizations = {},
  id = template.templateId,
): CallAssistDemoScenario {
  return {
    id,
    libraryId,
    name: template.name,
    description: template.description,
    expectedTriageClassification: template.expectedTriageClassification,
    expectedTransferTrigger: template.expectedTransferTrigger,
    evaluationCriteria: template.evaluationCriteria.map((c) => ({ ...c })),
    callerUtterances: template.callerUtterances.map((u) => ({
      ...u,
      text: interpolateDemoUtterance(u.text, customizations),
    })),
  };
}

/**
 * Base evaluation library shipped with Call Assist.
 * Streets, callbacks, and landmarks stay generic; agencies overlay local names.
 */
export const CALL_ASSIST_DEMO_SCENARIO_TEMPLATES: readonly DemoScenarioTemplate[] = [
  {
    templateId: "demo-abandoned-vehicle",
    id: "demo-abandoned-vehicle",
    name: "Abandoned Vehicle",
    description: "Routine triage, full intake, online report eligibility.",
    expectedTriageClassification: "NON_EMERGENCY_POLICE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [
      { id: "triage", description: "Classifies as non-emergency police / abandoned vehicle" },
      { id: "intake", description: "Captures location and vehicle descriptors" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's an abandoned vehicle parked at {{localStreetExample}}. It's been there three days. White Ford pickup, plate ABC123. Nobody is hurt.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-noise-complaint",
    id: "demo-noise-complaint",
    name: "Noise Complaint",
    description: "Dynamic questioning without vehicle/plate; non-emergency queue.",
    expectedTriageClassification: "NOISE_COMPLAINT",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "triage", description: "Noise classification without forcing vehicle fields" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's loud music from a party next door at {{localStreetExample}}. It's still going on.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-theft-report",
    id: "demo-theft-report",
    name: "Theft Report",
    description: "Report-only workflow and CARFAX eligibility for a historical vehicle theft.",
    expectedTriageClassification: "CARFAX_REPORTING_ELIGIBLE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "carfax", description: "Vehicle crime not in progress is CARFAX-eligible" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "My car was stolen yesterday from {{localStreetExample}}. It's a blue Honda Civic plate XYZ999. Nobody was hurt.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-parking-complaint",
    id: "demo-parking-complaint",
    name: "Parking Complaint",
    description: "Parking classification and vehicle intake; 311 may be offered via tenant routing.",
    expectedTriageClassification: "PARKING",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "parking", description: "Parking classification with vehicle descriptors" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "Someone is blocking my driveway at {{localStreetExample}}. Red Toyota Camry.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-suspicious-person",
    id: "demo-suspicious-person",
    name: "Suspicious Person",
    description: "Starts non-emergency, then distress forces 911.",
    expectedTriageClassification: "EMERGENCY",
    expectedTransferTrigger: "EMERGENCY",
    evaluationCriteria: [{ id: "reclass", description: "Mid-call distress stops AI and transfers" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's a suspicious person walking around the parking lot at {{localStreetExample}}.",
        delayAfterPreviousMs: 0,
      },
      {
        sequence: 2,
        text: "Help me, he's going to kill me",
        delayAfterPreviousMs: 400,
        injectEmergencyKeyword: true,
      },
    ],
  },
  {
    templateId: "demo-welfare-check",
    id: "demo-welfare-check",
    name: "Welfare Check",
    description: "Incomplete information handling and callback collection.",
    expectedTriageClassification: "NON_EMERGENCY_POLICE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "welfare", description: "Welfare check classified; callback solicited if missing" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "Can you do a welfare check on my neighbor at {{localStreetExample}}? I haven't heard from her.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-non-emergency-reveals-emergency",
    id: "demo-non-emergency-reveals-emergency",
    name: "Non-Emergency Reveals Emergency",
    description: "Caller starts with vandalism, then discloses a gun.",
    expectedTriageClassification: "EMERGENCY",
    expectedTransferTrigger: "EMERGENCY",
    evaluationCriteria: [
      { id: "immutable_911", description: "Gun disclosure is Safety Engine TRANSFER_911; AI does not continue" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "Someone vandalized my mailbox yesterday at {{localStreetExample}}.",
        delayAfterPreviousMs: 0,
      },
      {
        sequence: 2,
        text: "Wait — he has a gun",
        delayAfterPreviousMs: 300,
        injectEmergencyKeyword: true,
      },
    ],
  },
  {
    templateId: "demo-water-main",
    id: "demo-water-main",
    name: "Water Main (External Transfer)",
    description: "Public works classification; tenant may warm-transfer to water department.",
    expectedTriageClassification: "PUBLIC_WORKS",
    expectedTransferTrigger: "EXTERNAL_AGENCY",
    evaluationCriteria: [
      { id: "external", description: "PUBLIC_WORKS can route EXTERNAL_AGENCY when the tenant directory is seeded" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's a water main burst on {{localStreetExample}} flooding the road. Callback is {{callbackExample}}.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-duplicate-call",
    id: "demo-duplicate-call",
    name: "Duplicate Call",
    description: "Same location as a prior session/CAD event — supplemental intake.",
    expectedTriageClassification: "NON_EMERGENCY_POLICE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [
      { id: "duplicate", description: "Duplicate detector flags matching location when history exists" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's an abandoned vehicle at {{localStreetExample}}. White Ford pickup.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    templateId: "demo-spanish-caller",
    id: "demo-spanish-caller",
    name: "Spanish-Language Caller",
    description: "Language detection and Spanish intake for an abandoned vehicle.",
    expectedTriageClassification: "NON_EMERGENCY_POLICE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "language", description: "Spanish cues set language=es without dropping triage" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "Hola, hay un carro abandonado en {{localStreetExample}}.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
];

const GENERIC_DEMO_CUSTOMIZATIONS: Record<string, AgencyDemoCustomizations> = {
  "demo-abandoned-vehicle": { streetExample: "1200 Main Street" },
  "demo-noise-complaint": { streetExample: "400 Oak Street" },
  "demo-theft-report": { streetExample: "800 Walnut" },
  "demo-parking-complaint": { streetExample: "55 Pine Street" },
  "demo-suspicious-person": { streetExample: "200 Grand Avenue" },
  "demo-welfare-check": { streetExample: "12 Elm Street" },
  "demo-non-emergency-reveals-emergency": { streetExample: "9 Cedar Lane" },
  "demo-water-main": { streetExample: "Oak Street", callbackExample: "555-0100" },
  "demo-duplicate-call": { streetExample: "1200 Main Street" },
  "demo-spanish-caller": { streetExample: "la calle Main" },
};

/** First-tenant overlay — example of local streets/callbacks, not product defaults. */
export const KCPD_DEMO_CUSTOMIZATIONS: Record<string, AgencyDemoCustomizations> = {
  "demo-abandoned-vehicle": { streetExample: "1200 Main Street" },
  "demo-noise-complaint": { streetExample: "400 Oak Street" },
  "demo-theft-report": { streetExample: "800 Walnut" },
  "demo-parking-complaint": { streetExample: "55 Pine Street" },
  "demo-suspicious-person": { streetExample: "200 Grand Avenue" },
  "demo-welfare-check": { streetExample: "12 Elm Street" },
  "demo-non-emergency-reveals-emergency": { streetExample: "9 Cedar Lane" },
  "demo-water-main": { streetExample: "Oak Street", callbackExample: "8165550100" },
  "demo-duplicate-call": { streetExample: "1200 Main Street" },
  "demo-spanish-caller": { streetExample: "la calle Main" },
};

const KCPD_DEMO_IDS: Record<string, string> = {
  "demo-abandoned-vehicle": "kcpd-s01",
  "demo-noise-complaint": "kcpd-s02",
  "demo-theft-report": "kcpd-s03",
  "demo-parking-complaint": "kcpd-s04",
  "demo-suspicious-person": "kcpd-s05",
  "demo-welfare-check": "kcpd-s06",
  "demo-non-emergency-reveals-emergency": "kcpd-s07",
  "demo-water-main": "kcpd-s08",
  "demo-duplicate-call": "kcpd-s09",
  "demo-spanish-caller": "kcpd-s10",
};

export type AgencyDemoScenario = {
  agencyId: string;
  templateId: string;
  customizations: AgencyDemoCustomizations;
};

export function instantiateDemoScenarios(
  templates: readonly DemoScenarioTemplate[],
  libraryId: string,
  customizationsByTemplateId: Record<string, AgencyDemoCustomizations> = {},
  idsByTemplateId: Record<string, string> = {},
): CallAssistDemoScenario[] {
  return templates.map((template) =>
    scenarioFromTemplate(
      template,
      libraryId,
      customizationsByTemplateId[template.templateId] ?? {},
      idsByTemplateId[template.templateId] ?? template.templateId,
    ),
  );
}

export const CALL_ASSIST_DEMO_SCENARIOS: readonly CallAssistDemoScenario[] = instantiateDemoScenarios(
  CALL_ASSIST_DEMO_SCENARIO_TEMPLATES,
  BASE_LIBRARY_ID,
  GENERIC_DEMO_CUSTOMIZATIONS,
);

/** @deprecated First-tenant library id. Use call-assist-base for new agencies. */
export const KCPD_RFP_DEMO_SCENARIOS: readonly CallAssistDemoScenario[] = instantiateDemoScenarios(
  CALL_ASSIST_DEMO_SCENARIO_TEMPLATES,
  KCPD_LIBRARY_ID,
  KCPD_DEMO_CUSTOMIZATIONS,
  KCPD_DEMO_IDS,
);

const ALL_DEMO_SCENARIOS: readonly CallAssistDemoScenario[] = [
  ...CALL_ASSIST_DEMO_SCENARIOS,
  ...KCPD_RFP_DEMO_SCENARIOS,
];

export function listDemoScenariosForLibrary(libraryId = BASE_LIBRARY_ID): CallAssistDemoScenario[] {
  return ALL_DEMO_SCENARIOS.filter((s) => s.libraryId === libraryId).map(cloneScenario);
}

export function getDemoScenarioById(scenarioId: string): CallAssistDemoScenario | undefined {
  const found = ALL_DEMO_SCENARIOS.find((s) => s.id === scenarioId);
  return found ? cloneScenario(found) : undefined;
}
