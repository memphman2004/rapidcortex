import { z } from "zod";

/** Allowlisted tenants for Scenario Center. Production agencies are never valid here. */
export const DEMO_AGENCY_IDS = [
  "demo-campus-wlu",
  "demo-venue-stadium",
  "demo-transit",
  "demo-psap",
  "test-agency",
  "test-campus-uga",
  "test-venue-mbs",
] as const;

export type DemoAgencyId = (typeof DEMO_AGENCY_IDS)[number];

export function isDemoAgencyId(agencyId: string): boolean {
  return (DEMO_AGENCY_IDS as readonly string[]).includes(agencyId);
}

export const scenarioIdSchema = z.enum([
  "campus-medical-emergency",
  "campus-suspicious-person",
  "campus-active-threat",
  "venue-fight-section",
  "venue-lost-child",
  "transit-safety-complaint",
  "non-emergency-311",
  "multilingual-caller",
  "qr-nfc-report",
  "supervisor-qa-review",
  "ai-generated",
]);

export type ScenarioId = z.infer<typeof scenarioIdSchema>;

export const scenarioVerticalSchema = z.enum(["campus", "venue", "transit", "911"]);
export type ScenarioVertical = z.infer<typeof scenarioVerticalSchema>;

export const runScenarioBodySchema = z.object({
  agencyId: z.string().min(1).max(128),
});

export const generateScenarioBodySchema = z.object({
  agencyId: z.string().min(1).max(128),
  situation: z.string().trim().min(1).max(500),
  vertical: scenarioVerticalSchema,
});

export const qaSuiteBodySchema = z.object({
  agencyId: z.string().min(1).max(128),
  vertical: scenarioVerticalSchema,
});

export const resetDemoBodySchema = z.object({
  agencyId: z.string().min(1).max(128),
});

export type ValidationCheck = {
  checkId: string;
  description: string;
  uiLocation: string;
  expectedValue: string;
  checkType: "visible" | "text_match" | "color" | "count" | "exists" | "not_visible";
  required: boolean;
};

export type ScenarioEventRecord = {
  eventType: string;
  label: string;
  occurredAt: string;
  relativeSeconds: number;
  expectedInUI: string;
};

export type ScenarioStrategyUsed = "service_layer" | "ddb_direct" | "hybrid";

export type ScenarioResult = {
  scenarioId: ScenarioId;
  scenarioLabel: string;
  vertical: ScenarioVertical;
  agencyId: string;
  success: boolean;
  strategyUsed: ScenarioStrategyUsed;
  incidentId: string;
  incidentType: string;
  priority: 1 | 2 | 3 | 4 | 5;
  dashboardUrl: string;
  supervisorUrl: string;
  incidentDetailUrl: string;
  eventTimeline: ScenarioEventRecord[];
  validationChecklist: ValidationCheck[];
  seededAt: string;
  expiresAt: string;
  resetUrl: string;
  estimatedDemoMinutes: number;
  browserAgentPrompt: string;
};

export type ScenarioListItem = {
  id: ScenarioId;
  label: string;
  vertical: ScenarioVertical;
  description: string;
  estimatedDemoMinutes: number;
  tags: string[];
};

export type QaSuiteResult = {
  vertical: ScenarioVertical;
  totalScenarios: number;
  passed: number;
  failed: number;
  scenarios: Array<{
    scenarioId: string;
    label: string;
    passed: boolean;
    failedChecks: string[];
    durationMs: number;
    incidentId: string;
  }>;
  runAt: string;
  durationMs: number;
};

export class ScenarioError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScenarioError";
  }
}

export function isDemoIncidentRecord(record: { isDemoIncident?: boolean } | null | undefined): boolean {
  return record?.isDemoIncident === true;
}

export type ScenarioCreateIncidentParams = {
  type: string;
  priority: 1 | 2 | 3 | 4 | 5;
  location: { displayName: string; lat?: number; lng?: number };
  reporterMessage: string;
  reportMethod: "qr_scan" | "sms" | "phone" | "camera_alert";
  callerLanguage?: string;
};

/** Port implemented by API `ScenarioRunner` — scenarios must not invent extra services. */
export type ScenarioRunnerPort = {
  createIncident(params: ScenarioCreateIncidentParams): Promise<{ id: string }>;
  addAISummary(
    incidentId: string,
    params: { summary: string; confidence: number; suggestedResponse?: string[] },
  ): Promise<void>;
  addDispatcherNote(incidentId: string, params: { note: string }): Promise<void>;
  assignUnit(incidentId: string, params: { unitId: string; unitType?: string }): Promise<void>;
  bindCameras(incidentId: string, cameraIds: string[]): Promise<void>;
  escalateToSupervisor(incidentId: string, params: { reason: string }): Promise<void>;
  addDuplicateReport(incidentId: string, params: { message: string }): Promise<void>;
  addFieldUpdate(incidentId: string, params: { message: string }): Promise<void>;
  closeIncident(incidentId: string, params?: { disposition?: string }): Promise<void>;
  buildResult(
    incidentId: string,
    opts: {
      validationChecklist: ValidationCheck[];
      estimatedDemoMinutes?: number;
      strategyUsed?: ScenarioStrategyUsed;
      vertical?: ScenarioVertical;
      incidentType?: string;
      priority?: 1 | 2 | 3 | 4 | 5;
      scenarioLabel?: string;
    },
  ): ScenarioResult;
  adapters: {
    sms: { send(to: string, body: string): Promise<{ success: true; blocked: true }> };
    cad: {
      dispatch(payload: unknown): Promise<{ success: true; blocked: true; reason: string }>;
      submit(payload: unknown): Promise<{ success: true; blocked: true }>;
    };
    e911: { dispatch(payload: unknown): Promise<never> };
    camera: { getStreamUrl(cameraId: string): string };
  };
};

export type ScenarioDefinition = ScenarioListItem & {
  execute(agencyId: string, runner: ScenarioRunnerPort): Promise<ScenarioResult>;
};
