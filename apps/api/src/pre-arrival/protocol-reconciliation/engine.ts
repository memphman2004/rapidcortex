import { randomUUID } from "node:crypto";
import {
  isRestrictedNatureCode,
  resolveResponseIQInstructions,
  type ActiveStep,
  type IncidentUpdatedEvent,
  type ReconciliationResult,
  type SuspendedStepRecord,
} from "rapid-cortex-shared";
import { CompatibilityMatrix } from "./compatibility-matrix.js";
import { ReconciliationAuditLog } from "./audit-log.js";
import { preArrivalSessionStore } from "../session-store.js";

export class ProtocolReconciliationEngine {
  private readonly matrix = new CompatibilityMatrix();
  private readonly auditLog = new ReconciliationAuditLog();

  async reconcile(event: IncidentUpdatedEvent): Promise<ReconciliationResult | null> {
    const session = await preArrivalSessionStore.getActiveByIncident(event.incidentId, event.agencyId);
    if (!session) return null;

    const now = new Date().toISOString();
    const reconciliationId = randomUUID();

    if (isRestrictedNatureCode(event.newNatureCode)) {
      await preArrivalSessionStore.updateFields(session.agencyId, session.sessionToken, {
        status: "terminated",
        terminatedReason: `RESTRICTED_NATURE:${event.newNatureCode}`,
        endedAt: now,
        updatedAt: now,
        cadNatureCode: event.newNatureCode,
        responderStatus: session.responderStatus,
      });

      const body = {
        reconciliationId,
        incidentId: event.incidentId,
        sessionToken: session.sessionToken,
        agencyId: event.agencyId,
        priorNatureCode: event.priorNatureCode,
        newNatureCode: event.newNatureCode,
        dispatcherId: event.dispatcherId,
        reclassificationTimestamp: event.timestamp,
        reconciliationTimestamp: now,
        suspendedSteps: [] as SuspendedStepRecord[],
        replacementProtocolId: "TERMINATED",
        replacementStepCount: 0,
      };
      const auditRecord = { ...body, auditHash: ReconciliationAuditLog.computeHash(body) };
      await this.auditLog.write(auditRecord);
      return {
        sessionToken: session.sessionToken,
        incidentId: event.incidentId,
        priorNatureCode: event.priorNatureCode,
        newNatureCode: event.newNatureCode,
        suspendedSteps: [],
        replacementSteps: [],
        auditRecord,
        sessionTerminated: true,
      };
    }

    const rule = await this.matrix.resolve(event.agencyId, event.priorNatureCode, event.newNatureCode);
    const suspendedSteps: SuspendedStepRecord[] = [];
    const kept: ActiveStep[] = [];

    for (const step of session.activeSteps.filter((s) => s.status === "ACTIVE")) {
      if (this.matrix.isCompatible(rule, step.category, step.stepId)) {
        kept.push(step);
      } else {
        suspendedSteps.push({
          stepId: step.stepId,
          protocolId: step.protocolId,
          cadNatureCode: step.cadNatureCode,
          category: step.category,
          text: step.text,
          suspendedAt: now,
          suspensionReason: `INCIDENT_RECLASSIFIED:${event.newNatureCode}`,
        });
      }
    }

    const resolved = resolveResponseIQInstructions({
      cadNatureCode: event.newNatureCode,
      policy: session.modePolicy,
    });

    const replacementSteps: ActiveStep[] = resolved.instructions.map((ins, idx) => ({
      stepId: ins.stepId,
      protocolId: resolved.protocolId,
      cadNatureCode: event.newNatureCode,
      order: kept.length + idx + 1,
      category: ins.category,
      text: ins.text,
      status: "ACTIVE" as const,
      activatedAt: now,
    }));

    const mergedActive = [
      ...kept,
      ...replacementSteps,
    ];
    const instructions = mergedActive.map((s, i) => ({
      stepId: s.stepId,
      order: i + 1,
      text: s.text,
      category: s.category,
      status: s.status === "ACTIVE" || s.status === "COMPLETED" || s.status === "SUSPENDED" || s.status === "SKIPPED"
        ? s.status
        : ("ACTIVE" as const),
    }));

    await preArrivalSessionStore.updateFields(session.agencyId, session.sessionToken, {
      cadNatureCode: event.newNatureCode,
      protocolId: resolved.protocolId,
      instructionSource: resolved.source,
      activeSteps: mergedActive,
      instructions,
      updatedAt: now,
    });

    const body = {
      reconciliationId,
      incidentId: event.incidentId,
      sessionToken: session.sessionToken,
      agencyId: event.agencyId,
      priorNatureCode: event.priorNatureCode,
      newNatureCode: event.newNatureCode,
      dispatcherId: event.dispatcherId,
      reclassificationTimestamp: event.timestamp,
      reconciliationTimestamp: now,
      suspendedSteps,
      replacementProtocolId: resolved.protocolId,
      replacementStepCount: replacementSteps.length,
    };
    const auditRecord = { ...body, auditHash: ReconciliationAuditLog.computeHash(body) };
    await this.auditLog.write(auditRecord);

    return {
      sessionToken: session.sessionToken,
      incidentId: event.incidentId,
      priorNatureCode: event.priorNatureCode,
      newNatureCode: event.newNatureCode,
      suspendedSteps,
      replacementSteps,
      auditRecord,
      sessionTerminated: false,
    };
  }
}
