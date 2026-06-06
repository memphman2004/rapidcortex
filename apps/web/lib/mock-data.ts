import type { AIAnalysis, Incident, TranscriptSegment } from "rapid-cortex-shared";

export const MOCK_INCIDENTS: Incident[] = [
  {
    incidentId: "inc_mock_1",
    agencyId: "demo-agency",
    title: "Caller reports chest pain",
    category: "medical",
    urgency: "high",
    status: "active",
    source: "manual",
    confidence: 0.82,
    escalationFlag: false,
    summary: "Adult with chest pain, conscious.",
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    incidentId: "inc_mock_2",
    agencyId: "demo-agency",
    title: "Structure fire — smoke visible",
    category: "fire",
    urgency: "critical",
    status: "in_progress",
    source: "stream",
    confidence: 0.91,
    escalationFlag: true,
    summary: "Residential fire with possible entrapment.",
    createdAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60_000).toISOString(),
  },
  {
    incidentId: "inc_mock_3",
    agencyId: "demo-agency",
    title: "Noise complaint / domestic",
    category: "domestic_disturbance",
    urgency: "moderate",
    status: "active",
    source: "manual",
    confidence: 0.55,
    escalationFlag: false,
    summary: "Neighbor reports loud argument.",
    createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    incidentId: "inc_mock_4",
    agencyId: "city-prospect-demo",
    title: "Completed — welfare check resolved",
    category: "welfare_check",
    urgency: "moderate",
    status: "completed",
    source: "demo",
    confidence: 0.78,
    escalationFlag: false,
    summary: "Elder contacted; refused transport.",
    createdAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
  },
  {
    incidentId: "inc_mock_5",
    agencyId: "city-prospect-demo",
    title: "Archived — open-line hang-up",
    category: "unknown",
    urgency: "low",
    status: "archived",
    source: "stream",
    confidence: 0.31,
    escalationFlag: false,
    summary: "No voice contact; line cleared.",
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString(),
  },
];

const agencyId = "demo-agency";

export const MOCK_TRANSCRIPTS: Record<string, TranscriptSegment[]> = {
  inc_mock_1: [
    {
      segmentId: "seg_1",
      incidentId: "inc_mock_1",
      agencyId,
      speaker: "dispatcher",
      text: "911, what is the address of your emergency?",
      timestamp: new Date(Date.now() - 7 * 60_000).toISOString(),
    },
    {
      segmentId: "seg_2",
      incidentId: "inc_mock_1",
      agencyId,
      speaker: "caller",
      text: "My father is having really bad chest pain.",
      timestamp: new Date(Date.now() - 6 * 60_000).toISOString(),
    },
    {
      segmentId: "seg_3",
      incidentId: "inc_mock_1",
      agencyId,
      speaker: "dispatcher",
      text: "Is he conscious and breathing normally?",
      timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
    {
      segmentId: "seg_4",
      incidentId: "inc_mock_1",
      agencyId,
      speaker: "caller",
      text: "He's awake but says it hurts to breathe.",
      timestamp: new Date(Date.now() - 4 * 60_000).toISOString(),
    },
  ],
  inc_mock_2: [
    {
      segmentId: "seg_f1",
      incidentId: "inc_mock_2",
      agencyId,
      speaker: "caller",
      text: "There's black smoke coming from the house next door.",
      timestamp: new Date(Date.now() - 20 * 60_000).toISOString(),
    },
    {
      segmentId: "seg_f2",
      incidentId: "inc_mock_2",
      agencyId,
      speaker: "dispatcher",
      text: "Is anyone still inside the structure?",
      timestamp: new Date(Date.now() - 19 * 60_000).toISOString(),
    },
  ],
  inc_mock_3: [
    {
      segmentId: "seg_d1",
      incidentId: "inc_mock_3",
      agencyId,
      speaker: "caller",
      text: "I hear screaming and things breaking.",
      timestamp: new Date(Date.now() - 40 * 60_000).toISOString(),
    },
  ],
  inc_mock_4: [
    {
      segmentId: "seg_w1",
      incidentId: "inc_mock_4",
      agencyId: "city-prospect-demo",
      speaker: "dispatcher",
      text: "Units on scene — subject alert, vitals stable.",
      timestamp: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
    },
  ],
  inc_mock_5: [
    {
      segmentId: "seg_p1",
      incidentId: "inc_mock_5",
      agencyId: "city-prospect-demo",
      speaker: "system",
      text: "[Open line — no voice, ambient noise only]",
      timestamp: new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString(),
    },
  ],
};

export const MOCK_ANALYSES: Record<string, AIAnalysis> = {
  inc_mock_1: {
    analysisId: "analysis_mock_1",
    incidentId: "inc_mock_1",
    agencyId,
    category: "medical",
    urgency: "high",
    confidence: 0.82,
    nextQuestion: "Is the patient clammy, pale, or short of breath right now?",
    recommendedAction:
      "Prepare ALS response and keep caller on line for updated vitals.",
    summary: "Chest pain with respiratory complaint — possible ACS.",
    rationale: "Caller describes chest pain and pain with breathing.",
    escalationFlag: false,
    provider: "mock",
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
  inc_mock_2: {
    analysisId: "analysis_mock_2",
    incidentId: "inc_mock_2",
    agencyId,
    category: "fire",
    urgency: "critical",
    confidence: 0.91,
    nextQuestion: "Confirm evacuation status and exposures on all sides.",
    recommendedAction:
      "Dispatch full structure fire assignment; establish staging and accountability.",
    summary: "Active structure fire with smoke — high life-safety risk.",
    rationale: "Smoke from residential structure reported by third party.",
    escalationFlag: true,
    provider: "mock",
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  inc_mock_3: {
    analysisId: "analysis_mock_3",
    incidentId: "inc_mock_3",
    agencyId,
    category: "domestic_disturbance",
    urgency: "moderate",
    confidence: 0.55,
    nextQuestion: "Are weapons mentioned or visible to the caller?",
    recommendedAction:
      "Maintain open line; gather location and number of people involved.",
    summary: "Domestic disturbance suspected from neighbor report.",
    rationale: "Audible disturbance without confirmed weapons.",
    escalationFlag: false,
    provider: "mock",
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  inc_mock_4: {
    analysisId: "analysis_mock_4",
    incidentId: "inc_mock_4",
    agencyId: "city-prospect-demo",
    category: "welfare_check",
    urgency: "moderate",
    confidence: 0.78,
    nextQuestion: "Document refusal of transport per local policy.",
    recommendedAction: "Close welfare with on-scene disposition notes.",
    summary: "Welfare check cleared on scene.",
    rationale: "Dispatcher confirms subject alert and stable.",
    escalationFlag: false,
    provider: "mock",
    createdAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
  },
  inc_mock_5: {
    analysisId: "analysis_mock_5",
    incidentId: "inc_mock_5",
    agencyId: "city-prospect-demo",
    category: "unknown",
    urgency: "low",
    confidence: 0.31,
    nextQuestion: "N/A — line cleared.",
    recommendedAction: "Archive as abandoned / no voice.",
    summary: "No actionable content on open line.",
    rationale: "System-only segment with no caller speech.",
    escalationFlag: false,
    provider: "mock",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString(),
  },
};

export function mockListIncidents(): Incident[] {
  return [...MOCK_INCIDENTS].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function mockGetIncident(id: string): Incident | null {
  return MOCK_INCIDENTS.find((i) => i.incidentId === id) ?? null;
}

export function mockGetTranscript(incidentId: string): TranscriptSegment[] {
  return MOCK_TRANSCRIPTS[incidentId] ?? [];
}

export function mockGetLatestAnalysis(incidentId: string): AIAnalysis | null {
  return MOCK_ANALYSES[incidentId] ?? null;
}
