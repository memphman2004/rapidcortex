import type { ScenarioDefinition, ScenarioRunnerPort, ValidationCheck } from "rapid-cortex-shared";

export const DEMO_BANNER_CHECK: ValidationCheck = {
  checkId: "demo-banner",
  description: "SIMULATION MODE banner visible",
  uiLocation: "Top of every page",
  expectedValue: "SIMULATION MODE — NOT A REAL INCIDENT",
  checkType: "visible",
  required: true,
};

export function incidentQueueCheck(expectedValue: string): ValidationCheck {
  return {
    checkId: "incident-active",
    description: "Incident appears in active queue",
    uiLocation: "Dispatcher console → Active Incidents",
    expectedValue,
    checkType: "text_match",
    required: true,
  };
}

export function aiSummaryCheck(snippet: string): ValidationCheck {
  return {
    checkId: "ai-summary-present",
    description: "AI summary visible",
    uiLocation: "Incident detail → Intelligence / summary",
    expectedValue: snippet.slice(0, 60),
    checkType: "text_match",
    required: true,
  };
}

export async function runStandardWalkthrough(
  runner: ScenarioRunnerPort,
  opts: {
    type: string;
    priority: 1 | 2 | 3 | 4 | 5;
    location: { displayName: string; lat?: number; lng?: number };
    reporterMessage: string;
    reportMethod: "qr_scan" | "sms" | "phone" | "camera_alert";
    callerLanguage?: string;
    aiSummary: string;
    cameraIds?: string[];
    units?: Array<{ unitId: string; unitType?: string }>;
    note?: string;
    escalateReason?: string;
    duplicateMessage?: string;
    fieldUpdate?: string;
    extraChecks?: ValidationCheck[];
  },
): Promise<{ id: string; checks: ValidationCheck[] }> {
  const incident = await runner.createIncident({
    type: opts.type,
    priority: opts.priority,
    location: opts.location,
    reporterMessage: opts.reporterMessage,
    reportMethod: opts.reportMethod,
    callerLanguage: opts.callerLanguage,
  });

  await runner.addAISummary(incident.id, {
    summary: opts.aiSummary,
    confidence: 0.88,
    suggestedResponse: opts.units?.map((u) => u.unitType ?? u.unitId),
  });

  if (opts.cameraIds?.length) {
    await runner.bindCameras(incident.id, opts.cameraIds);
  }
  for (const unit of opts.units ?? []) {
    await runner.assignUnit(incident.id, unit);
  }
  if (opts.note) {
    await runner.addDispatcherNote(incident.id, { note: opts.note });
  }
  if (opts.escalateReason) {
    await runner.escalateToSupervisor(incident.id, { reason: opts.escalateReason });
  }
  if (opts.duplicateMessage) {
    await runner.addDuplicateReport(incident.id, { message: opts.duplicateMessage });
  }
  if (opts.fieldUpdate) {
    await runner.addFieldUpdate(incident.id, { message: opts.fieldUpdate });
  }

  return {
    id: incident.id,
    checks: [
      DEMO_BANNER_CHECK,
      incidentQueueCheck(`${opts.type} — Priority ${opts.priority}`),
      aiSummaryCheck(opts.aiSummary),
      ...(opts.extraChecks ?? []),
    ],
  };
}

export function finish(
  def: Omit<ScenarioDefinition, "execute">,
  runner: ScenarioRunnerPort,
  incidentId: string,
  checks: ValidationCheck[],
  extras?: { incidentType?: string; priority?: 1 | 2 | 3 | 4 | 5 },
) {
  return runner.buildResult(incidentId, {
    validationChecklist: checks,
    estimatedDemoMinutes: def.estimatedDemoMinutes,
    vertical: def.vertical,
    scenarioLabel: def.label,
    incidentType: extras?.incidentType,
    priority: extras?.priority,
  });
}
