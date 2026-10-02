import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  SOP_INTELLIGENCE_PATTERN_THRESHOLD,
  deriveSopIntelligenceCoaching,
  sopIntelligencePhase2Schema,
  sopLibraryDocumentPatchSchema,
  sopLibraryStepPatchSchema,
  sopPendingActionSchema,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";
import {
  newReportId,
  sopIntelligenceStore,
  type DiscrepancyReportRecord,
  type SopLibraryRecord,
} from "../../sop-intelligence/store.js";
import { triggerSopPatternAnalyzer } from "../../sop-intelligence/trigger.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function rest(path: string): string[] {
  const idx = path.indexOf("/api/sop-intelligence/");
  const tail = idx >= 0 ? path.slice(idx + "/api/sop-intelligence/".length) : "";
  return tail.split("/").filter(Boolean);
}

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw new Error("FORBIDDEN");
  }
}

async function safeAudit(event: Parameters<AuditRepository["create"]>[0]): Promise<void> {
  try {
    await auditRepo.create(event);
  } catch (err) {
    console.warn(JSON.stringify({ msg: "sop_intel_audit_failed", err: String(err) }));
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableSopIntelligence) {
      return withCorrelationHeaders(event, serviceUnavailable("SOP Intelligence is not enabled"));
    }
    if (!env.sopIntelligenceReportsTable) {
      return withCorrelationHeaders(event, serviceUnavailable("SOP Intelligence tables are not configured"));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const agencyId = user.agencyId;
    if (!agencyId) return withCorrelationHeaders(event, forbidden());

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const parts = rest(path);
    const body = parseBody(event.body);
    if (event.body && body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    if (method === "GET" && parts[0] === "snapshot") {
      requirePerm(user, "sop_intelligence.view");
      const [library, reports, patterns, pending] = await Promise.all([
        sopIntelligenceStore.ensureLibrarySeeded(agencyId),
        sopIntelligenceStore.listReports(agencyId),
        sopIntelligenceStore.listPatterns(agencyId),
        sopIntelligenceStore.listPending(agencyId),
      ]);
      const gapReports = reports.filter((r) => r.sopGapIdentified);
      const pendingOpen = pending.filter((p) => p.status === "pending");
      const analyzed = reports.length;
      const deviationRate = analyzed === 0 ? 0 : Math.round((gapReports.length / analyzed) * 1000) / 10;
      const coaching = deriveSopIntelligenceCoaching(
        patterns.map((p) => ({
          sopId: p.sopId,
          stepId: p.stepId,
          sopTitle: p.sopTitle,
          gapCount: p.gapCount,
        })),
        gapReports.map((r) => ({
          reportId: r.reportId,
          dispatcherName: r.dispatcherName,
          sopId: r.sopId,
          stepId: r.stepId,
          callId: r.callId,
          createdAt: r.createdAt,
          gapDescription: r.gapDescription,
        })),
      );
      const bySop = patterns
        .map((p) => ({
          sopId: p.sopId,
          stepId: p.stepId,
          title: p.sopTitle,
          gapCount: p.gapCount,
          suggestionGenerated: p.suggestionGenerated,
        }))
        .sort((a, b) => b.gapCount - a.gapCount);
      return withCorrelationHeaders(
        event,
        ok({
          kpis: {
            callsAnalyzed: analyzed,
            callsWithGaps: gapReports.length,
            pendingUpdates: pendingOpen.length,
            deviationRate,
          },
          library,
          reports,
          patterns: bySop,
          pending,
          coaching,
          threshold: SOP_INTELLIGENCE_PATTERN_THRESHOLD,
        }),
      );
    }

    if (method === "GET" && parts[0] === "library" && parts.length === 1) {
      requirePerm(user, "sop_intelligence.view");
      const library = await sopIntelligenceStore.ensureLibrarySeeded(agencyId);
      return withCorrelationHeaders(event, ok({ items: library }));
    }

    if (method === "PUT" && parts[0] === "library" && parts[1] && parts[2] === "steps" && parts[3]) {
      requirePerm(user, "sop_intelligence.manage");
      const parsed = sopLibraryStepPatchSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const sopId = parts[1];
      const stepId = parts[3];
      const current = await sopIntelligenceStore.getLibraryDoc(agencyId, sopId);
      if (!current) return withCorrelationHeaders(event, notFound("SOP not found"));
      const now = new Date().toISOString();
      const next: SopLibraryRecord = {
        ...current,
        version: current.version + 1,
        lastUpdated: now,
        lastUpdatedBy: user.userId,
        steps: current.steps.map((s) =>
          s.stepId === stepId ? { ...s, text: parsed.data.text, updatedAt: now } : s,
        ),
      };
      await sopIntelligenceStore.putLibraryDoc(next, current);
      await safeAudit({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_LIBRARY_EDITED,
        details: { sopId, stepId, version: next.version },
        createdAt: now,
        resourceType: "agency",
        resourceId: sopId,
      });
      return withCorrelationHeaders(event, ok({ item: next }));
    }

    if (method === "PUT" && parts[0] === "library" && parts[1] && parts.length === 2) {
      requirePerm(user, "sop_intelligence.manage");
      const parsed = sopLibraryDocumentPatchSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const sopId = parts[1];
      const current = await sopIntelligenceStore.getLibraryDoc(agencyId, sopId);
      if (!current) return withCorrelationHeaders(event, notFound("SOP not found"));
      const now = new Date().toISOString();
      const next: SopLibraryRecord = {
        ...current,
        title: parsed.data.title ?? current.title,
        version: current.version + 1,
        lastUpdated: now,
        lastUpdatedBy: user.userId,
        steps: parsed.data.steps
          ? current.steps.map((s) => {
              const patch = parsed.data.steps?.find((p) => p.stepId === s.stepId);
              return patch ? { ...s, text: patch.text, stepNumber: patch.stepNumber, updatedAt: now } : s;
            })
          : current.steps,
      };
      await sopIntelligenceStore.putLibraryDoc(next, current);
      await safeAudit({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_LIBRARY_EDITED,
        details: { sopId, version: next.version },
        createdAt: now,
        resourceType: "agency",
        resourceId: sopId,
      });
      return withCorrelationHeaders(event, ok({ item: next }));
    }

    if (method === "GET" && parts[0] === "pending") {
      requirePerm(user, "sop_intelligence.view");
      const items = await sopIntelligenceStore.listPending(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "pending" && parts[1] && parts[2]) {
      requirePerm(user, "sop_intelligence.manage");
      const parsed = sopPendingActionSchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const updateId = parts[1];
      const action = parts[2];
      const pending = await sopIntelligenceStore.getPending(agencyId, updateId);
      if (!pending) return withCorrelationHeaders(event, notFound("Pending update not found"));
      if (pending.status !== "pending" && pending.status !== "deferred") {
        return withCorrelationHeaders(event, badRequest("Pending update is no longer actionable"));
      }
      const now = new Date().toISOString();
      if (action === "approve") {
        const lib = await sopIntelligenceStore.getLibraryDoc(agencyId, pending.sopId);
        if (!lib) return withCorrelationHeaders(event, notFound("SOP not found"));
        const nextLib: SopLibraryRecord = {
          ...lib,
          version: lib.version + 1,
          lastUpdated: now,
          lastUpdatedBy: user.userId,
          pendingUpdateId: undefined,
          steps: lib.steps.map((s) =>
            s.stepId === pending.stepId ? { ...s, text: pending.suggestedLang, updatedAt: now } : s,
          ),
        };
        await sopIntelligenceStore.putLibraryDoc(nextLib, lib);
        pending.status = "approved";
        pending.approvedBy = user.userId;
        pending.approvedAt = now;
        await sopIntelligenceStore.savePending(pending);
        await safeAudit({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_PENDING_APPROVED,
          details: { updateId, sopId: pending.sopId, stepId: pending.stepId, version: nextLib.version },
          createdAt: now,
          resourceType: "agency",
          resourceId: updateId,
        });
        await broadcastToAgency({
          agencyId,
          message: { type: "sop-intel.pending.updated", data: { updateId, status: "approved" } },
        }).catch(() => undefined);
        return withCorrelationHeaders(event, ok({ item: pending, library: nextLib }));
      }
      if (action === "defer") {
        pending.status = "deferred";
        pending.deferredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        pending.ttl = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
        await sopIntelligenceStore.savePending(pending);
        await safeAudit({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_PENDING_DEFERRED,
          details: { updateId, reason: parsed.data.reason ?? "" },
          createdAt: now,
          resourceType: "agency",
          resourceId: updateId,
        });
        await broadcastToAgency({
          agencyId,
          message: { type: "sop-intel.pending.updated", data: { updateId, status: "deferred" } },
        }).catch(() => undefined);
        return withCorrelationHeaders(event, ok({ item: pending }));
      }
      if (action === "dismiss") {
        pending.status = "dismissed";
        await sopIntelligenceStore.savePending(pending);
        await safeAudit({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_PENDING_DISMISSED,
          details: { updateId, reason: parsed.data.reason ?? "" },
          createdAt: now,
          resourceType: "agency",
          resourceId: updateId,
        });
        await broadcastToAgency({
          agencyId,
          message: { type: "sop-intel.pending.updated", data: { updateId, status: "dismissed" } },
        }).catch(() => undefined);
        return withCorrelationHeaders(event, ok({ item: pending }));
      }
      return withCorrelationHeaders(event, badRequest("Unknown pending action"));
    }

    if (method === "POST" && parts[0] === "reports" && parts[1] === "phase2") {
      requirePerm(user, "sop_intelligence.submit");
      const parsed = sopIntelligencePhase2Schema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      await sopIntelligenceStore.ensureLibrarySeeded(agencyId);
      const input = parsed.data;
      const now = new Date().toISOString();
      const reportId = newReportId();
      const report: DiscrepancyReportRecord = {
        PK: agencyId,
        SK: `REPORT#${reportId}`,
        GSI1PK: input.sopGapIdentified && input.sopId ? `GAP#${agencyId}#${input.sopId}` : `NOGAP#${agencyId}`,
        GSI1SK: now,
        agencyId,
        reportId,
        callId: input.callId,
        dispatcherName: input.dispatcherName,
        telecom: input.telecom,
        whatHappened: input.whatHappened,
        actionTaken: input.actionTaken,
        sopGapIdentified: input.sopGapIdentified,
        sopId: input.sopId,
        stepId: input.stepId,
        gapDescription: input.gapDescription,
        rootCause: input.rootCause,
        gisCorrection: input.gisCorrection,
        vendorTicket: input.vendorTicket,
        resolutionStatus: input.resolutionStatus,
        investigationNotes: input.investigationNotes,
        level: input.level ?? (input.sopGapIdentified ? "HIGH" : "LOW"),
        phase: 2,
        createdAt: now,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      };
      await sopIntelligenceStore.putReport(report);

      let pattern = null;
      let thresholdReached = false;
      if (input.sopGapIdentified && input.sopId && input.stepId) {
        const lib = await sopIntelligenceStore.getLibraryDoc(agencyId, input.sopId);
        pattern = await sopIntelligenceStore.incrementPattern({
          agencyId,
          sopId: input.sopId,
          stepId: input.stepId,
          sopTitle: lib?.title ?? `SOP ${input.sopId}`,
          reportId,
          gapDescription: input.gapDescription,
        });
        thresholdReached =
          pattern.gapCount >= SOP_INTELLIGENCE_PATTERN_THRESHOLD && !pattern.suggestionGenerated;
        try {
          await broadcastToAgency({
            agencyId,
            message: {
              type: "sop-intel.pattern.updated",
              data: {
                sopId: pattern.sopId,
                stepId: pattern.stepId,
                gapCount: pattern.gapCount,
                thresholdReached,
              },
            },
          });
        } catch {
          /* non-fatal */
        }
        if (thresholdReached) {
          await triggerSopPatternAnalyzer({
            agencyId,
            sopId: pattern.sopId,
            stepId: pattern.stepId,
            gapCount: pattern.gapCount,
            reportIds: pattern.reportIds,
          }).catch((err) => {
            console.warn(JSON.stringify({ msg: "sop_intel_trigger_failed", err: String(err) }));
          });
        }
      }

      await safeAudit({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: thresholdReached
          ? AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_PATTERN_THRESHOLD
          : AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_REPORT_SUBMITTED,
        details: {
          reportId,
          callId: input.callId,
          sopGapIdentified: input.sopGapIdentified,
          sopId: input.sopId ?? "",
          stepId: input.stepId ?? "",
          gapCount: pattern?.gapCount ?? 0,
        },
        createdAt: now,
        resourceType: "agency",
        resourceId: reportId,
      });

      return withCorrelationHeaders(
        event,
        ok({ report, pattern, thresholdReached, threshold: SOP_INTELLIGENCE_PATTERN_THRESHOLD }),
      );
    }

    return withCorrelationHeaders(event, notFound("Unknown SOP Intelligence route"));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.warn(JSON.stringify({ msg: "sop_intel_http_error", err: String(error) }));
    return withCorrelationHeaders(event, serverError());
  }
};
