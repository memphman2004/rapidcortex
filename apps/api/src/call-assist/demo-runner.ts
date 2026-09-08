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
import { initiateSession, processUtterance } from "./session-pipeline.js";

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
  for (const utt of scenario.callerUtterances) {
    const result = await processUtterance({
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      sessionId: session.sessionId,
      text: utt.text,
    });
    steps.push({
      sequence: utt.sequence,
      text: utt.text,
      classification: result.session.triage?.primaryClassification,
      action: result.session.safety?.action,
      continueAiConversation: result.session.continueAiConversation,
      state: result.session.state,
    });
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
    passed,
    steps,
    expectedClassification: scenario.expectedTriageClassification,
    actualClassification: last?.classification,
    expectedTransferTrigger: scenario.expectedTransferTrigger,
    actualTransferTrigger,
  };
}
