/**
 * POST /api/rms/reports/generate
 * Sync Claude generation → JSON. Web BFF wraps as SSE (grant-writer pattern).
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  GenerateReportRequestSchema,
  isRcsuperadmin,
  type IncidentPerson,
  type IncidentReport,
  type IncidentVehicle,
} from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  buildReportPrompt,
  nibrsFromParsed,
  parseJsonObject,
  streamClaudeText,
} from "../../lib/rms/claude-report.js";
import { auditRmsMutation, AUDIT_EVENT_TYPES } from "../../lib/rms/audit.js";
import { saveReport } from "../../lib/rms/reports-db.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";

const authz = new AuthorizationService();

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableRms) {
      return withCorrelationHeaders(event, badRequest("RMS capabilities are not enabled"));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    try {
      authz.assertCanPerform(user, "rms.generate_report");
    } catch {
      return withCorrelationHeaders(event, forbidden());
    }

    const raw = parseBody(event);
    if (raw === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    const parsedReq = GenerateReportRequestSchema.safeParse(raw);
    if (!parsedReq.success) {
      return withCorrelationHeaders(event, badRequest(parsedReq.error.message));
    }
    const req = parsedReq.data;

    const agencyId = isRcsuperadmin(user)
      ? (req.agencyId || user.agencyId)
      : user.agencyId;
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
    if (!isRcsuperadmin(user) && req.agencyId && req.agencyId !== user.agencyId) {
      return withCorrelationHeaders(event, forbidden());
    }

    const prompt = buildReportPrompt({ ...req, agencyId });
    const rawText = await streamClaudeText(prompt);
    const parsed = parseJsonObject(rawText);

    const reportId = makeId("rpt");
    const now = new Date().toISOString();
    const report: IncidentReport = {
      reportId,
      agencyId,
      incidentId: req.incidentId,
      incidentType: req.extractedEntities.incidentType ?? "Unknown",
      incidentDate: req.callMetadata?.callDate ?? now.slice(0, 10),
      incidentTime: req.callMetadata?.callTime ?? now.slice(11, 16),
      incidentAddress: req.extractedEntities.location ?? "",
      incidentCity: "",
      incidentState: req.agencyPreferences?.jurisdictionState ?? "",
      cadIncidentNumber: req.callMetadata?.cadNumber,
      suspects: (parsed.suspects as IncidentPerson[]) ?? [],
      victims: (parsed.victims as IncidentPerson[]) ?? [],
      witnesses: (parsed.witnesses as IncidentPerson[]) ?? [],
      vehicles: (parsed.vehicles as IncidentVehicle[]) ?? [],
      narrative: {
        officerNarrative: String(parsed.officerNarrative ?? ""),
        suspectDescription: (parsed.suspectDescription as string | null) ?? undefined,
        victimInformation: (parsed.victimInformation as string | null) ?? undefined,
        vehicleInformation: (parsed.vehicleInformation as string | null) ?? undefined,
        evidenceSummary: (parsed.evidenceSummary as string | null) ?? undefined,
        officerObservations: (parsed.officerObservations as string | null) ?? undefined,
        dispositionSummary: (parsed.dispositionSummary as string | null) ?? undefined,
      },
      nibrsClassification: nibrsFromParsed(parsed),
      nibrsConfirmed: false,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      createdBy: user.email ?? user.userId ?? "unknown",
      transcriptWordCount: req.transcript.trim().split(/\s+/).filter(Boolean).length,
      extractedEntitiesCount: Object.values(req.extractedEntities).filter(Boolean).length,
      sourceCallDurationSeconds: req.callMetadata?.callDurationSeconds,
    };

    await saveReport(report);
    await auditRmsMutation({
      type: AUDIT_EVENT_TYPES.RMS_REPORT_GENERATED,
      user,
      agencyId,
      incidentId: report.incidentId,
      reportId: report.reportId,
      metadata: { status: report.status },
    });
    return withCorrelationHeaders(event, ok({ report }));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rms_generate_report_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};
