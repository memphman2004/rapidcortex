import {
  demoScenarioPresetsForVertical,
  getDemoScenarioById,
  listDemoScenariosForLibrary,
  type CallAssistDemoScenario,
  type CallAssistDemoScenarioConfig,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore } from "./store.js";
import { getOrCreateConfig } from "./config-service.js";
import { completeSession, initiateSession, processUtterance } from "./session-pipeline.js";

const auditRepo = new AuditRepository();

export type DemoStepResult = {
  sequence: number;
  text: string;
  classification?: string;
  action?: string;
  continueAiConversation: boolean;
  state: string;
};

export type DemoRunResult = {
  runId: string;
  scenarioId: string;
  sessionId: string;
  caseNumber?: string;
  passed: boolean;
  steps: DemoStepResult[];
  expectedClassification: string;
  actualClassification?: string;
  expectedTransferTrigger: string;
  actualTransferTrigger: string;
};

function actualTrigger(steps: DemoStepResult[]): string {
  if (steps.some((s) => s.action === "TRANSFER_911" || s.state === "TRANSFERRING_911")) return "EMERGENCY";
  if (steps.some((s) => s.state === "TRANSFERRING_EXTERNAL")) return "EXTERNAL_AGENCY";
  if (steps.some((s) => s.state === "TRANSFERRING_HUMAN")) return "HUMAN_REQUESTED";
  return "NONE";
}

const DEMO_EARLY_STOP_STATES = new Set(["TRANSFERRING_911", "FAILED"]);
const DEMO_TERMINAL_STATES = new Set([
  "TRANSFERRING_911",
  "TRANSFERRING_HUMAN",
  "TRANSFERRING_EXTERNAL",
  "COMPLETED",
  "FAILED",
]);

export function isDemoTerminalState(state: string): boolean {
  return DEMO_TERMINAL_STATES.has(state);
}

function isDemoEarlyStopState(state: string): boolean {
  return DEMO_EARLY_STOP_STATES.has(state);
}

/** Synthetic caller line used to finish leftover intake so a demo never stalls. */
export function demoDrainUtterance(opts: {
  state: string;
  continueAiConversation: boolean;
  lastQuestionId?: string | null;
  nextQuestion?: string | null;
}): string | null {
  if (isDemoTerminalState(opts.state)) return null;
  if (opts.state === "CALLBACK_OFFERED") return "No thank you";
  if (!opts.continueAiConversation && !opts.nextQuestion) return null;
  const id = (opts.lastQuestionId ?? "").toLowerCase();
  const prompt = opts.nextQuestion ?? "";
  if (id === "apartment" || /apartment|suite|unit number/i.test(prompt)) return "No unit number";
  if (id === "cross_streets" || /cross streets/i.test(prompt)) return "Oak and 19th";
  if (id === "callback" || /callback|phone number|call you back|devolverle/i.test(prompt)) return "555-0142";
  if (id === "vehicle_plate" || (/license plate|placa/i.test(prompt) && !/make|model|color/i.test(prompt))) {
    return "I don't have the plate";
  }
  if (id.startsWith("vehicle") || /vehicle|color, make|make, model|marca/i.test(prompt)) return "Blue Honda Civic";
  if (id === "location" || /address|location|intersection|direcci[oó]n/i.test(prompt)) return "1200 Main Street";
  if (id === "in_progress" || /happening right now|already happen/i.test(prompt)) return "No, it already happened";
  if (id === "injuries" || /hurt or injured/i.test(prompt)) return "No";
  if (id === "weapons" || /any weapons/i.test(prompt)) return "No";
  if (/violation|blocking|hydrant|driveway/i.test(prompt)) return "Blocking a driveway";
  if (/how long|been there/i.test(prompt)) return "Three days";
  return "I don't know";
}

function toStep(sequence: number, text: string, session: {
  triage?: { primaryClassification?: string };
  safety?: { action?: string };
  continueAiConversation: boolean;
  state: string;
}): DemoStepResult {
  return {
    sequence,
    text,
    classification: session.triage?.primaryClassification,
    action: session.safety?.action,
    continueAiConversation: session.continueAiConversation,
    state: session.state,
  };
}

function toEngineScenario(s: CallAssistDemoScenarioConfig): CallAssistDemoScenario {
  const emergency = s.expectedClass === "EMERGENCY" || s.expectedClass === "emergency";
  return {
    id: s.id,
    libraryId: s.source === "custom" ? "custom" : `preset-${s.vertical}`,
    name: s.label,
    description: s.label,
    expectedTriageClassification: s.expectedClass,
    expectedTransferTrigger: emergency ? "EMERGENCY" : "NONE",
    evaluationCriteria: [],
    callerUtterances: s.utterances.map((text, i) => ({
      sequence: i + 1,
      text,
      delayAfterPreviousMs: i === 0 ? 0 : 300,
      injectEmergencyKeyword: emergency && i > 0 ? true : undefined,
    })),
  };
}

export async function listDemoScenariosForAgency(agencyId: string): Promise<CallAssistDemoScenario[]> {
  const config = await getOrCreateConfig(agencyId);
  const stored = (config.demoScenarios ?? []).filter((s) => s.enabled !== false);
  if (stored.length > 0) return stored.map(toEngineScenario);
  const vertical = config.vertical ?? config.uiVertical ?? "911";
  if (vertical === "campus" || vertical === "venue") {
    return demoScenarioPresetsForVertical(vertical).map(toEngineScenario);
  }
  return listDemoScenariosForLibrary();
}

export async function runDemoScenario(opts: {
  agencyId: string;
  actorId: string;
  scenarioId: string;
}): Promise<DemoRunResult> {
  if (!env.enableCallAssistDemoMode) {
    throw new Error("DEMO_MODE_DISABLED");
  }
  const library = await listDemoScenariosForAgency(opts.agencyId);
  const scenario = library.find((s) => s.id === opts.scenarioId) ?? getDemoScenarioById(opts.scenarioId);
  if (!scenario) throw new Error("SCENARIO_NOT_FOUND");

  const session = await initiateSession({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    source: "DEMO",
    mode: "NON_EMERGENCY",
  });

  const steps: DemoStepResult[] = [];
  let current = session;
  for (const utt of scenario.callerUtterances) {
    const result = await processUtterance({
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      sessionId: session.sessionId,
      text: utt.text,
    });
    current = result.session;
    steps.push(toStep(utt.sequence, utt.text, current));
    if (isDemoEarlyStopState(current.state)) break;
  }

  for (let extra = 0; extra < 12; extra += 1) {
    const text = demoDrainUtterance({
      state: current.state,
      continueAiConversation: current.continueAiConversation,
      lastQuestionId: current.lastQuestionId,
      nextQuestion: current.nextQuestion,
    });
    if (!text) break;
    const result = await processUtterance({
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      sessionId: session.sessionId,
      text,
    });
    current = result.session;
    steps.push(toStep(steps.length + 1, text, current));
    if (isDemoEarlyStopState(current.state)) break;
  }

  if (!isDemoTerminalState(current.state)) {
    current = await completeSession(opts.agencyId, current.sessionId, opts.actorId);
    steps.push(toStep(steps.length + 1, "[demo complete]", current));
  }

  const last = steps[steps.length - 1];
  const actualTransferTrigger = actualTrigger(steps);
  const passed =
    last?.classification === scenario.expectedTriageClassification &&
    (scenario.expectedTransferTrigger === "NONE" ||
      actualTransferTrigger === scenario.expectedTransferTrigger) &&
    (scenario.expectedTransferTrigger !== "EMERGENCY" ||
      steps.some((s) => s.action === "TRANSFER_911" && s.continueAiConversation === false));

  const runId = makeId("cdr");
  const record = {
    agencyId: opts.agencyId,
    runId,
    scenarioId: scenario.id,
    sessionId: session.sessionId,
    source: "DEMO",
    passed,
    steps,
    createdAt: new Date().toISOString(),
  };
  await callAssistStore.putDemoRun(record);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_DEMO_RUN,
    details: { scenarioId: scenario.id, passed, sessionId: session.sessionId },
    createdAt: new Date().toISOString(),
    resourceType: "session",
    resourceId: session.sessionId,
  });

  return {
    runId,
    scenarioId: scenario.id,
    sessionId: session.sessionId,
    caseNumber: current.caseNumber ?? session.caseNumber,
    passed,
    steps,
    expectedClassification: scenario.expectedTriageClassification,
    actualClassification: last?.classification,
    expectedTransferTrigger: scenario.expectedTransferTrigger,
    actualTransferTrigger,
  };
}
