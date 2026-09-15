/**
 * ScenarioRunner — orchestrates Scenario Center execution.
 *
 * IMPLEMENTATION STRATEGY: C (hybrid)
 *   Reason (Phase 0):
 *   - `IncidentService.create()` exists (`apps/api/src/services/incidentService.ts`)
 *     and is used by `createIncident.ts`. It does NOT accept adapter DI and does
 *     NOT publish WebSocket events. Inventing `createIncident(params, mockAdapters)`
 *     would not match this codebase.
 *   - There is no IntelligenceService / CameraService / DispatchService. Notes,
 *     units, cameras, and close are repository patches + `incidentTimelineLogger`.
 *   - Real-time: `WebSocketNotificationService.broadcastIncidentCreated()`
 *     (`INCIDENT_CREATED` via `broadcastToAgency`). Must be called after every
 *     create — the dashboard will not live-update without it.
 *
 * Real-time propagation:
 *   WebSocketNotificationService.broadcastIncidentCreated → INCIDENT_CREATED
 *
 * SMS / CAD:
 *   Scenario-side MockSmsAdapter / MockCadAdapter (never live).
 *   Production: SMS factory + CAD write adapter also check isDemoIncident.
 *
 * E911:
 *   No dedicated 911 adapter in this repo. BlockedE911Adapter throws if called.
 */

import type {
  Incident,
  ScenarioCreateIncidentParams,
  ScenarioEventRecord,
  ScenarioId,
  ScenarioResult,
  ScenarioRunnerPort,
  ScenarioStrategyUsed,
  ScenarioVertical,
  UserContext,
  ValidationCheck,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { IncidentService } from "../services/incidentService.js";
import { assertDemoMode } from "./demo-incident-guards.js";
import { buildMockAdapters, type ScenarioMockAdapters } from "./mock-adapters.js";

const WEB_BASE_URL = (process.env.WEB_BASE_URL ?? process.env.APP_ORIGIN ?? "https://app.rapidcortex.us").replace(
  /\/$/,
  "",
);
const TTL_SECONDS = 7200;
const STRATEGY_USED: ScenarioStrategyUsed = "hybrid";

const incidentService = new IncidentService();
const incidentRepo = new IncidentRepository();

function urgencyFromPriority(priority: 1 | 2 | 3 | 4 | 5): Incident["urgency"] {
  if (priority === 1) return "critical";
  if (priority === 2) return "high";
  if (priority === 3) return "moderate";
  return "low";
}

function categoryFromType(type: string): Incident["category"] {
  const t = type.toUpperCase();
  if (t.startsWith("MED") || t.includes("CARDIAC") || t.includes("OD") || t.includes("PSYCH")) return "medical";
  if (t.startsWith("FIRE")) return "fire";
  if (t.startsWith("WELFARE") || t === "ABANDON") return "welfare_check";
  if (t.includes("DOMESTIC")) return "domestic_disturbance";
  if (t.startsWith("LEW") || t.startsWith("TRF") || t.includes("WEAPON") || t.includes("ASSAULT")) return "police";
  return "unknown";
}

function cadPriorityFromPriority(priority: 1 | 2 | 3 | 4 | 5): string {
  return `P${Math.min(priority, 4)}`;
}

export class ScenarioRunner implements ScenarioRunnerPort {
  private readonly agencyId: string;
  private readonly scenarioId: ScenarioId;
  private readonly actor: UserContext;
  private readonly runId: string;
  private readonly startedAt: Date;
  private readonly events: ScenarioEventRecord[] = [];
  private readonly mocks: ScenarioMockAdapters;
  private lastIncidentType = "unknown";
  private lastPriority: 1 | 2 | 3 | 4 | 5 = 3;
  private lastVertical: ScenarioVertical = "campus";

  constructor(agencyId: string, scenarioId: ScenarioId, actor: UserContext) {
    assertDemoMode(agencyId);
    this.agencyId = agencyId;
    this.scenarioId = scenarioId;
    this.actor = { ...actor, agencyId };
    this.runId = makeId("scn");
    this.startedAt = new Date();
    this.mocks = buildMockAdapters();
  }

  get adapters(): ScenarioRunnerPort["adapters"] {
    return {
      sms: this.mocks.sms,
      cad: this.mocks.cad,
      e911: this.mocks.e911,
      camera: this.mocks.camera,
    };
  }

  setVertical(vertical: ScenarioVertical): void {
    this.lastVertical = vertical;
  }

  async createIncident(params: ScenarioCreateIncidentParams): Promise<{ id: string }> {
    this.lastIncidentType = params.type;
    this.lastPriority = params.priority;
    const incident = await incidentService.create(
      `${params.type} — ${params.location.displayName}`,
      "demo",
      this.actor,
      {
        callerAddressLine: params.location.displayName,
        summary: params.reporterMessage,
        cadNatureCode: params.type,
        cadPriority: cadPriorityFromPriority(params.priority),
        cadLocation: params.location.displayName,
        cadCoordinates:
          params.location.lat != null && params.location.lng != null
            ? { lat: params.location.lat, lng: params.location.lng }
            : undefined,
        category: categoryFromType(params.type),
        urgency: urgencyFromPriority(params.priority),
        callerLanguage: params.callerLanguage ?? null,
        isDemoIncident: true,
        demoScenarioId: this.scenarioId,
        dispatchBlocked: true,
        dispatchBlockReason: "DEMO",
        ttl: this.ttl(),
      },
    );

    try {
      await this.mocks.realtime.broadcastIncidentCreated({
        agencyId: this.agencyId,
        incidentId: incident.incidentId,
        source: "demo",
      });
    } catch (err: unknown) {
      console.warn(
        JSON.stringify({
          type: "scenario.ws_broadcast_failed",
          incidentId: incident.incidentId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    this.pushEvent("incident.created", `${params.type} created`, "Dispatcher console → Active Incidents");
    return { id: incident.incidentId };
  }

  async addAISummary(
    incidentId: string,
    params: { summary: string; confidence: number; suggestedResponse?: string[] },
  ): Promise<void> {
    const current = await this.requireOwnedDemo(incidentId);
    const extra = params.suggestedResponse?.length
      ? `\n\nSuggested response: ${params.suggestedResponse.join(", ")}`
      : "";
    const summary = [current.summary?.trim(), `[DEMO AI ${(params.confidence * 100).toFixed(0)}%] ${params.summary}${extra}`]
      .filter(Boolean)
      .join("\n\n");
    await incidentRepo.patchScenarioDemoFields(incidentId, this.agencyId, { summary });
    await this.safeTimeline(incidentId, "ai_analysis_created", "ai", {
      summary: params.summary,
      confidence: params.confidence,
      demo: true,
    });
    this.pushEvent("ai.summary", "AI summary attached", "Incident detail → Intelligence / summary");
  }

  async addDispatcherNote(incidentId: string, params: { note: string }): Promise<void> {
    await this.requireOwnedDemo(incidentId);
    await this.safeTimeline(incidentId, "dispatcher_note", "dispatcher", { content: params.note, demo: true });
    this.pushEvent("dispatcher.note", "Dispatcher note added", "Incident detail → Timeline");
  }

  async assignUnit(incidentId: string, params: { unitId: string; unitType?: string }): Promise<void> {
    const current = await this.requireOwnedDemo(incidentId);
    const units = [...(current.cadUnits ?? []), params.unitId];
    await incidentRepo.patchScenarioDemoFields(incidentId, this.agencyId, { cadUnits: units });
    await this.safeTimeline(incidentId, "unit_dispatched", "dispatcher", {
      unitId: params.unitId,
      unitType: params.unitType,
      demo: true,
    });
    this.pushEvent("unit.assigned", `Unit ${params.unitId} assigned`, "Incident detail → Units");
  }

  async bindCameras(incidentId: string, cameraIds: string[]): Promise<void> {
    await this.requireOwnedDemo(incidentId);
    await incidentRepo.patchScenarioDemoFields(incidentId, this.agencyId, { demoCameraIds: cameraIds });
    this.pushEvent("cameras.bound", `${cameraIds.length} camera(s) associated`, "Incident detail → Cameras / Media");
  }

  async escalateToSupervisor(incidentId: string, params: { reason: string }): Promise<void> {
    await this.requireOwnedDemo(incidentId);
    await incidentRepo.patchDispatchFields(incidentId, { escalationFlag: true });
    await this.safeTimeline(incidentId, "supervisor_joined", "dispatcher", { reason: params.reason, demo: true });
    this.pushEvent("supervisor.escalate", "Escalated to supervisor", "Supervisor console → Escalated queue");
  }

  async addDuplicateReport(incidentId: string, params: { message: string }): Promise<void> {
    const parent = await this.requireOwnedDemo(incidentId);
    await incidentService.create(`Duplicate report — ${parent.title}`, "demo", this.actor, {
      callerAddressLine: parent.callerAddressLine ?? parent.cadLocation ?? undefined,
      summary: params.message,
      cadNatureCode: parent.cadNatureCode,
      cadPriority: parent.cadPriority,
      cadLocation: parent.cadLocation,
      category: parent.category,
      urgency: parent.urgency,
      isDemoIncident: true,
      demoScenarioId: this.scenarioId,
      dispatchBlocked: true,
      dispatchBlockReason: "DEMO",
      ttl: this.ttl(),
    });
    this.pushEvent("duplicate.report", "Linked duplicate report", "Incident detail → Related / prior incidents");
  }

  async addFieldUpdate(incidentId: string, params: { message: string }): Promise<void> {
    const current = await this.requireOwnedDemo(incidentId);
    const summary = [current.summary?.trim(), `[Field] ${params.message}`].filter(Boolean).join("\n\n");
    await incidentRepo.patchScenarioDemoFields(incidentId, this.agencyId, { summary });
    await this.safeTimeline(incidentId, "manual_override", "dispatcher", { content: params.message, demo: true });
    this.pushEvent("field.update", "Field update posted", "Incident detail → Timeline");
  }

  async closeIncident(incidentId: string, params?: { disposition?: string }): Promise<void> {
    await this.requireOwnedDemo(incidentId);
    await incidentRepo.patchScenarioDemoFields(incidentId, this.agencyId, { status: "completed" });
    await this.safeTimeline(incidentId, "incident_closed", "dispatcher", {
      disposition: params?.disposition ?? "DEMO_COMPLETE",
      demo: true,
    });
    this.pushEvent("incident.closed", "Incident closed", "Dispatcher console — incident no longer active");
  }

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
  ): ScenarioResult {
    const vertical = opts.vertical ?? this.lastVertical;
    const incidentDetailUrl = `${WEB_BASE_URL}/${this.agencyId}/incidents/${incidentId}`;
    const checklist = opts.validationChecklist;
    return {
      scenarioId: this.scenarioId,
      scenarioLabel: opts.scenarioLabel ?? titleCaseId(this.scenarioId),
      vertical,
      agencyId: this.agencyId,
      success: true,
      strategyUsed: opts.strategyUsed ?? STRATEGY_USED,
      incidentId,
      incidentType: opts.incidentType ?? this.lastIncidentType,
      priority: opts.priority ?? this.lastPriority,
      dashboardUrl: `${WEB_BASE_URL}/${this.agencyId}/dashboard`,
      supervisorUrl: `${WEB_BASE_URL}/${this.agencyId}/supervisor`,
      incidentDetailUrl,
      eventTimeline: this.events,
      validationChecklist: checklist,
      seededAt: this.startedAt.toISOString(),
      expiresAt: this.expiresAt(),
      resetUrl: `${WEB_BASE_URL}/api/demo/reset?agencyId=${encodeURIComponent(this.agencyId)}`,
      estimatedDemoMinutes: opts.estimatedDemoMinutes ?? 5,
      browserAgentPrompt: this.buildBrowserAgentPrompt(incidentDetailUrl, checklist),
    };
  }

  private async requireOwnedDemo(incidentId: string): Promise<Incident> {
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== this.agencyId) {
      throw new Error(`Incident ${incidentId} not found for agency ${this.agencyId}`);
    }
    if (incident.isDemoIncident !== true) {
      throw new Error(`Incident ${incidentId} is not a demo record`);
    }
    return incident;
  }

  private async safeTimeline(
    incidentId: string,
    kind: Parameters<typeof incidentTimelineLogger.emit>[0]["kind"],
    source: Parameters<typeof incidentTimelineLogger.emit>[0]["source"],
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await incidentTimelineLogger.emit({
        incidentId,
        agencyId: this.agencyId,
        kind,
        source,
        actorId: this.actor.userId,
        actorRole: this.actor.role,
        payload,
      });
    } catch (err: unknown) {
      console.warn(
        JSON.stringify({
          type: "scenario.timeline_failed",
          incidentId,
          kind,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  private pushEvent(eventType: string, label: string, expectedInUI: string): void {
    this.events.push({
      eventType,
      label,
      occurredAt: new Date().toISOString(),
      relativeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      expectedInUI,
    });
  }

  private ttl(): number {
    return Math.floor(Date.now() / 1000) + TTL_SECONDS;
  }

  private expiresAt(): string {
    return new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  }

  private buildBrowserAgentPrompt(url: string, checklist: ValidationCheck[]): string {
    const items = checklist
      .map(
        (c, i) =>
          `${i + 1}. [${c.checkId}] ${c.description}\n` +
          `   WHERE: ${c.uiLocation}\n` +
          `   EXPECT: ${c.expectedValue}\n` +
          `   TYPE: ${c.checkType}${c.required ? " (REQUIRED)" : " (optional)"}`,
      )
      .join("\n\n");

    return `You are validating a Rapid Cortex demo scenario.

IMPORTANT SAFETY RULES:
- Do NOT click "Dispatch", "Send SMS", "Submit to CAD", or "Call 911"
- If you see a red SIMULATION MODE banner, you are in the correct environment

DASHBOARD URL: ${url}
RUN ID: ${this.runId}

VALIDATION CHECKLIST:
${items}

For each item: navigate, verify, report PASS or FAIL with one sentence.
If all REQUIRED checks pass: report SCENARIO VALIDATED.
If any REQUIRED check fails: report VALIDATION FAILED — [list failures].`;
  }
}

function titleCaseId(id: string): string {
  return id.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export async function resetDemoIncidents(agencyId: string): Promise<{ deleted: number }> {
  assertDemoMode(agencyId);
  const items = await incidentRepo.listByAgencyWithLimit(agencyId, 200);
  let deleted = 0;
  for (const inc of items) {
    if (inc.isDemoIncident !== true) continue;
    const ok = await incidentRepo.deleteDemoIncident(agencyId, inc.incidentId);
    if (ok) deleted += 1;
  }
  return { deleted };
}
