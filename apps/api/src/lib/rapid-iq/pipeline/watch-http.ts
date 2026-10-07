/**
 * Canonical Watch Intelligence HTTP surface (/api/watch/*).
 * Reuses Rapid IQ pipeline storage — Discovery ≠ Lead.
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  isCanonicalWatchSignal,
  pushRapidIqPipelineToCrmBodySchema,
  rapidIqWatchIngestRequestSchema,
  watchSignalActionBodySchema,
  watchSignalSchema,
  watchSignalToPipelineIngest,
  type RapidIqPipelineSignal,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../ids.js";
import { badRequest, notFound, ok, unauthorized } from "../../response.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import { ingestWatchSignal } from "./ingest-watch-signal.js";
import { assertWatchIngestApiKey } from "./watch-ingest-auth.js";
import {
  getSignal,
  listSignalsForCommandCenter,
  updateSignalFields,
} from "./rapid-iq-pipeline-db.js";
import { createCrmLeadFromPipelineSignal } from "../../../handlers/rapid-iq/pipeline/push-to-crm.js";
import { env } from "../../env.js";

const auditRepo = new AuditRepository();

type JsonResult = ReturnType<typeof ok>;

function parseBody(event: APIGatewayProxyEventV2): unknown {
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

function watchIdFromPath(path: string): string | undefined {
  const m = path.match(/\/api\/watch\/signals\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function isWatchSource(signal: RapidIqPipelineSignal): boolean {
  return signal.sourceId === "chatgpt-watch" || Boolean(signal.externalKey);
}

function toWatchCard(signal: RapidIqPipelineSignal) {
  return {
    id: signal.signalId,
    external_key: signal.externalKey ?? null,
    status: signal.status,
    agency: {
      name: signal.agencyName ?? null,
      department: signal.department ?? null,
      city: signal.jurisdiction ?? null,
      state: signal.state ?? null,
    },
    title: signal.rawTitle,
    primary_vertical: signal.primaryVertical ?? signal.vertical ?? null,
    verticals: signal.verticals ?? (signal.vertical ? [signal.vertical] : []),
    signal_type: signal.buyingSignalType ?? signal.procurementStage ?? null,
    buying_stage: signal.buyingStage ?? null,
    strength: signal.signalStrength ?? null,
    fit: signal.fitLabel,
    strategy: signal.watchStrategy ?? null,
    funding: {
      estimated_contract_value: signal.estimatedContractValue ?? signal.dollarAmount ?? null,
      project_budget: signal.projectBudget ?? null,
      grant_amount: signal.fundingAmount ?? null,
      annual_support: signal.annualRecurringBudget ?? null,
      funding_source: signal.fundingSource ?? null,
    },
    solicitation_number: signal.solicitationNumber ?? null,
    due_date: signal.deadline ?? null,
    lifecycle_change: signal.activities?.[0]?.changeType ?? null,
    matched_capabilities: signal.matchedCapabilities ?? [],
    next_action: signal.recommendedAction ?? null,
    facts: signal.facts ?? [],
    inferences: signal.inferences ?? [],
    evidence: signal.evidence ?? [],
    activities: signal.activities ?? [],
    priority_score: signal.priorityScore ?? signal.combinedScore ?? signal.fitScore,
    priority_label: signal.priorityLabel ?? null,
    watched: signal.watched ?? false,
    assigned_user: signal.assignedUser ?? null,
    possible_duplicate: signal.possibleDuplicate ?? false,
    possible_duplicate_of: signal.possibleDuplicateOf ?? null,
    crm_record_id: signal.crmLeadId ?? null,
    first_discovered_at: signal.firstDiscoveredAt ?? signal.ingestedAt,
    last_updated_at: signal.lastWatchUpdateAt ?? signal.processedAt ?? signal.ingestedAt,
    evidence_count: signal.evidence?.length ?? 0,
    watch: signal.watchName ?? null,
  };
}

async function auditWatch(
  userId: string,
  signalId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: "platform",
      actorId: userId,
      type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_SIGNAL_UPDATED,
      details: { surface: "watch_inbox", ...details },
      createdAt: new Date().toISOString(),
      resourceType: "rapid_iq_pipeline_signal",
      resourceId: signalId,
    });
  } catch {
    /* never fail on audit */
  }
}

export async function handleWatchIngestCanonical(
  event: APIGatewayProxyEventV2,
): Promise<JsonResult> {
  if (!env.enableNexiQPipeline) {
    return ok({ success: false, error: "SERVICE_UNAVAILABLE" }, 503);
  }
  const auth = await assertWatchIngestApiKey(event);
  if (!auth.ok) {
    if (auth.reason === "ingest_not_configured" || auth.reason === "secret_unavailable") {
      return ok({ success: false, error: "INGEST_NOT_CONFIGURED" }, 503);
    }
    return unauthorized("Invalid watch ingest API key");
  }

  const body = parseBody(event);
  if (body === null) {
    return ok(
      { success: false, error: "VALIDATION_ERROR", details: [{ message: "Invalid JSON" }] },
      400,
    );
  }
  if (Array.isArray(body)) {
    return ok(
      {
        success: false,
        error: "VALIDATION_ERROR",
        details: [
          {
            message: "One signal per POST — arrays are not accepted on /api/watch/ingest",
          },
        ],
      },
      400,
    );
  }

  if (isCanonicalWatchSignal(body)) {
    const parsed = watchSignalSchema.safeParse(body);
    if (!parsed.success) {
      return ok(
        {
          success: false,
          error: "VALIDATION_ERROR",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    }
    const { body: mapped, enrichments } = watchSignalToPipelineIngest(parsed.data);
    const result = await ingestWatchSignal(mapped, enrichments);
    await auditWatch("system:chatgpt-watch", result.signal.signalId, {
      action: result.action,
      externalKey: result.signal.externalKey,
      lifecycleEventCreated: result.lifecycleEventCreated,
    });
    return ok({
      success: true,
      action: result.action,
      signal_id: result.signal.signalId,
      external_key: result.signal.externalKey ?? mapped.external_key,
      lifecycle_event_created: Boolean(result.lifecycleEventCreated),
      possible_duplicate: result.signal.possibleDuplicate || undefined,
      possible_duplicate_of: result.signal.possibleDuplicateOf,
      priority_score: result.signal.priorityScore,
      priority_label: result.signal.priorityLabel,
    });
  }

  const legacy = rapidIqWatchIngestRequestSchema.safeParse(body);
  if (!legacy.success) {
    return ok(
      {
        success: false,
        error: "VALIDATION_ERROR",
        details: legacy.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }
  const item = Array.isArray(legacy.data) ? legacy.data[0]! : legacy.data;
  const result = await ingestWatchSignal(item);
  return ok({
    success: true,
    action: result.action,
    signal_id: result.signal.signalId,
    external_key: result.signal.externalKey ?? item.external_key,
    lifecycle_event_created: Boolean(result.lifecycleEventCreated),
    possible_duplicate: result.signal.possibleDuplicate || undefined,
    possible_duplicate_of: result.signal.possibleDuplicateOf,
  });
}

export async function handleWatchHttp(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<JsonResult | null> {
  const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
  const path = event.rawPath ?? event.requestContext.http?.path ?? "";
  if (!path.includes("/api/watch")) return null;

  if (method === "GET" && (path.endsWith("/api/watch/health") || path.endsWith("/api/watch/health/"))) {
    return ok({
      status: "ok",
      service: "watch-ingest",
      timestamp: new Date().toISOString(),
    });
  }

  if (method === "GET" && (path.endsWith("/api/watch/stats") || path.endsWith("/api/watch/stats/"))) {
    const all = (await listSignalsForCommandCenter()).filter(isWatchSource);
    const byStatus: Record<string, number> = {};
    const byVertical: Record<string, number> = {};
    for (const s of all) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      const v = s.primaryVertical ?? s.vertical ?? "unknown";
      byVertical[v] = (byVertical[v] ?? 0) + 1;
    }
    return ok({
      total: all.length,
      by_status: byStatus,
      by_vertical: byVertical,
      monitoring: all.filter((s) => s.watched).length,
      high_fit: all.filter((s) => s.fitLabel === "high").length,
    });
  }

  if (method === "GET" && (path.endsWith("/api/watch/signals") || path.endsWith("/api/watch/signals/"))) {
    let signals = (await listSignalsForCommandCenter()).filter(isWatchSource);
    const q = event.queryStringParameters ?? {};
    if (q.status) signals = signals.filter((s) => s.status === q.status);
    if (q.vertical) {
      signals = signals.filter(
        (s) =>
          s.primaryVertical === q.vertical ||
          s.vertical === q.vertical ||
          s.verticals?.includes(q.vertical!),
      );
    }
    if (q.state) signals = signals.filter((s) => s.state?.toUpperCase() === q.state!.toUpperCase());
    if (q.fit) signals = signals.filter((s) => s.fitLabel === q.fit);
    if (q.watched === "1" || q.watched === "true") signals = signals.filter((s) => s.watched);
    if (q.q?.trim()) {
      const needle = q.q.trim().toLowerCase();
      signals = signals.filter((s) =>
        [s.agencyName, s.rawTitle, s.solicitationNumber, s.summary, ...(s.competitors ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    signals.sort(
      (a, b) =>
        (b.priorityScore ?? b.combinedScore ?? b.fitScore) -
        (a.priorityScore ?? a.combinedScore ?? a.fitScore),
    );
    return ok({ signals: signals.map(toWatchCard), count: signals.length });
  }

  const signalId = watchIdFromPath(path);
  if (!signalId) return notFound("Not found");

  const signal = await getSignal(signalId);
  if (!signal || !isWatchSource(signal)) return notFound("Watch signal not found");

  if (method === "GET" && /\/api\/watch\/signals\/[^/]+\/?$/.test(path)) {
    return ok({ signal: toWatchCard(signal), raw: signal });
  }

  if (method === "PATCH" && /\/api\/watch\/signals\/[^/]+\/?$/.test(path)) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const assigned =
      typeof body === "object" && body && "assigned_user" in body
        ? String((body as { assigned_user?: string | null }).assigned_user ?? "")
        : undefined;
    const status =
      typeof body === "object" && body && "status" in body
        ? String((body as { status?: string }).status ?? "")
        : undefined;
    const watched =
      typeof body === "object" && body && "watched" in body
        ? Boolean((body as { watched?: boolean }).watched)
        : undefined;
    const updated = await updateSignalFields(signalId, {
      ...(status ? { status: status as RapidIqPipelineSignal["status"] } : {}),
      ...(watched != null ? { watched } : {}),
      ...(assigned !== undefined ? { assignedUser: assigned || null } : {}),
    });
    await auditWatch(user.userId, signalId, { action: "patch", status, watched, assigned });
    return ok({ signal: toWatchCard(updated) });
  }

  const actionBody = watchSignalActionBodySchema.safeParse(parseBody(event) ?? {});
  const action = actionBody.success ? actionBody.data : {};

  if (method === "POST" && path.endsWith("/dismiss")) {
    const updated = await updateSignalFields(signalId, {
      status: "dismissed",
      dismissReason: action?.reason,
      dismissedBy: user.email ?? user.userId,
    });
    await auditWatch(user.userId, signalId, { action: "dismiss", reason: action?.reason });
    return ok({ signal: toWatchCard(updated) });
  }

  if (method === "POST" && path.endsWith("/monitor")) {
    const updated = await updateSignalFields(signalId, { watched: true });
    await auditWatch(user.userId, signalId, { action: "monitor" });
    return ok({ signal: toWatchCard(updated), badge: "MONITORING" });
  }

  if (method === "POST" && path.endsWith("/assign")) {
    const assignee = action?.assigned_user?.trim();
    if (!assignee) return badRequest("assigned_user is required");
    const updated = await updateSignalFields(signalId, { assignedUser: assignee });
    await auditWatch(user.userId, signalId, { action: "assign", assigned_user: assignee });
    return ok({ signal: toWatchCard(updated) });
  }

  if (method === "POST" && path.endsWith("/qualify")) {
    if (signal.status === "pushed") {
      return ok(
        { success: false, error: "ALREADY_QUALIFIED", crm_record_id: signal.crmLeadId },
        409,
      );
    }
    const crmBody = pushRapidIqPipelineToCrmBodySchema.safeParse({
      overrideAgencyName: signal.agencyName,
      notes:
        [action?.deal_name ? `Deal: ${action.deal_name}` : null, action?.notes, signal.recommendedAction]
          .filter(Boolean)
          .join("\n") || undefined,
    });
    if (!crmBody.success) return badRequest(crmBody.error.message);
    const caller = user.email ?? user.userId;
    try {
      const { leadId, enrichment } = await createCrmLeadFromPipelineSignal(
        signal,
        crmBody.data,
        caller,
      );
      const updated = await updateSignalFields(signalId, {
        status: "pushed",
        crmLeadId: leadId,
      });
      await auditWatch(user.userId, signalId, {
        action: "qualify",
        crm_record_id: leadId,
      });
      return ok({
        success: true,
        crm_record_id: leadId,
        source_watch_signal_id: signalId,
        enrichment,
        signal: toWatchCard(updated),
      });
    } catch (err) {
      return ok(
        {
          success: false,
          error: "QUALIFY_FAILED",
          message: err instanceof Error ? err.message : "Qualify failed",
        },
        500,
      );
    }
  }

  return null;
}

export function isWatchHealthPath(path: string): boolean {
  return path.endsWith("/api/watch/health") || path.endsWith("/api/watch/health/");
}

export function isWatchIngestCanonicalPath(path: string): boolean {
  return path.endsWith("/api/watch/ingest") || path.endsWith("/api/watch/ingest/");
}

export function isWatchApiPath(path: string): boolean {
  return path.includes("/api/watch");
}
