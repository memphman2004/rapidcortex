import type { CallTriageClassification } from "./classifications.js";

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

/**
 * Reference evaluation library (KCPD RFP 2026-0010 criteria).
 * Core engines stay agency-agnostic; this is seed content for a tenant library.
 */
export const KCPD_RFP_DEMO_SCENARIOS: readonly CallAssistDemoScenario[] = [
  {
    id: "kcpd-s01",
    libraryId: "kcpd-rfp-2026",
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
        text: "There's an abandoned vehicle parked at 1200 Main Street. It's been there three days. White Ford pickup, plate ABC123. Nobody is hurt.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s02",
    libraryId: "kcpd-rfp-2026",
    name: "Noise Complaint",
    description: "Dynamic questioning without vehicle/plate; non-emergency queue.",
    expectedTriageClassification: "NOISE_COMPLAINT",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "triage", description: "Noise classification without forcing vehicle fields" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's loud music from a party next door at 400 Oak Street. It's still going on.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s03",
    libraryId: "kcpd-rfp-2026",
    name: "Theft Report",
    description: "Report-only workflow and CARFAX eligibility for a historical vehicle theft.",
    expectedTriageClassification: "CARFAX_REPORTING_ELIGIBLE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [
      { id: "carfax", description: "Vehicle crime not in progress is CARFAX-eligible" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "My car was stolen yesterday from 800 Walnut. It's a blue Honda Civic plate XYZ999. Nobody was hurt.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s04",
    libraryId: "kcpd-rfp-2026",
    name: "Parking Complaint",
    description: "Parking classification and vehicle intake; 311 may be offered via tenant routing.",
    expectedTriageClassification: "PARKING",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "parking", description: "Parking classification with vehicle descriptors" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "Someone is blocking my driveway at 55 Pine Street. Red Toyota Camry.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s05",
    libraryId: "kcpd-rfp-2026",
    name: "Suspicious Person",
    description: "Starts non-emergency, then distress forces 911.",
    expectedTriageClassification: "EMERGENCY",
    expectedTransferTrigger: "EMERGENCY",
    evaluationCriteria: [
      { id: "reclass", description: "Mid-call distress stops AI and transfers" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "There's a suspicious person walking around the parking lot at 200 Grand Avenue.",
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
    id: "kcpd-s06",
    libraryId: "kcpd-rfp-2026",
    name: "Welfare Check",
    description: "Incomplete information handling and callback collection.",
    expectedTriageClassification: "NON_EMERGENCY_POLICE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [{ id: "welfare", description: "Welfare check classified; callback solicited if missing" }],
    callerUtterances: [
      {
        sequence: 1,
        text: "Can you do a welfare check on my neighbor at 12 Elm Street? I haven't heard from her.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s07",
    libraryId: "kcpd-rfp-2026",
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
        text: "Someone vandalized my mailbox yesterday at 9 Cedar Lane.",
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
    id: "kcpd-s08",
    libraryId: "kcpd-rfp-2026",
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
        text: "There's a water main burst on Oak Street flooding the road. Callback is 8165550100.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s09",
    libraryId: "kcpd-rfp-2026",
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
        text: "There's an abandoned vehicle at 1200 Main Street. White Ford pickup.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
  {
    id: "kcpd-s10",
    libraryId: "kcpd-rfp-2026",
    name: "Spanish-Language Caller",
    description: "Language detection and Spanish intake for an abandoned vehicle.",
    expectedTriageClassification: "NON_EMERGENCY_POLICE",
    expectedTransferTrigger: "NONE",
    evaluationCriteria: [
      { id: "language", description: "Spanish cues set language=es without dropping triage" },
    ],
    callerUtterances: [
      {
        sequence: 1,
        text: "Hola, hay un carro abandonado en la calle Main.",
        delayAfterPreviousMs: 0,
      },
    ],
  },
] as const;

export function listDemoScenariosForLibrary(libraryId = "kcpd-rfp-2026"): CallAssistDemoScenario[] {
  return KCPD_RFP_DEMO_SCENARIOS.filter((s) => s.libraryId === libraryId).map((s) => ({
    ...s,
    callerUtterances: s.callerUtterances.map((u) => ({ ...u })),
    evaluationCriteria: s.evaluationCriteria.map((c) => ({ ...c })),
  }));
}

export function getDemoScenarioById(scenarioId: string): CallAssistDemoScenario | undefined {
  const found = KCPD_RFP_DEMO_SCENARIOS.find((s) => s.id === scenarioId);
  if (!found) return undefined;
  return {
    ...found,
    callerUtterances: found.callerUtterances.map((u) => ({ ...u })),
    evaluationCriteria: found.evaluationCriteria.map((c) => ({ ...c })),
  };
}
