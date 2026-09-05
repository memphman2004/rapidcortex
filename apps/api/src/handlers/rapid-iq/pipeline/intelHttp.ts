/**
 * Opportunity Intelligence HTTP API.
 * Routes: /api/rapid-iq/intel/*
 * RBAC: same as pipeline (canAccessRapidIq).
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  createRapidIqIntelWatchBodySchema,
  defaultTransitWatchKeywords,
  intelStrategicPriority,
  patchRapidIqIntelOpportunityBodySchema,
  patchRapidIqIntelWatchBodySchema,
  rapidIqIntelManualIngestBodySchema,
  rapidIqIntelOutreachBodySchema,
  type RapidIqIntelOpportunity,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../../lib/ids.js";
import {
  getIntelOpportunity,
  getIntelWatch,
  listIntelOpportunities,
  listIntelWatches,
  putIntelWatch,
  seedDefaultIntelWatches,
  updateIntelOpportunityFields,
  updateIntelWatchFields,
} from "../../../lib/rapid-iq/intel-db.js";
import { getRfpCountSnapshot } from "./rfp-unified-counter.js";
import { processSourceDocument, processWatch } from "../../../lib/rapid-iq/intel-process.js";
import { enqueueIntelWatchJob } from "../../../lib/rapid-iq/intel-queue.js";
import { sourceDocumentFromManual } from "../../../lib/rapid-iq/intel-sources.js";
import {
  analyzeOpportunity,
  generateBidNoBidAnalysis,
  generateOutreach,
  generatePursuitBrief,
} from "../../../lib/rapid-iq/openai-service.js";
import { fetchIngestText, stripHtml } from "../../../lib/rapid-iq/pipeline/ingest-fetch.js";
import { upsertIntelOpportunity } from "../../../lib/rapid-iq/intel-upsert.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  ok,
} from "../../../lib/response.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

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

function intelIdFromPath(path: string, params?: Record<string, string | undefined>): string | undefined {
  if (params?.intelId?.trim()) return params.intelId.trim();
  const m = path.match(/\/intel\/opportunities\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function watchIdFromPath(path: string, params?: Record<string, string | undefined>): string | undefined {
  if (params?.watchId?.trim()) return params.watchId.trim();
  const m = path.match(/\/intel\/watches\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

async function audit(
  user: UserContext,
  type: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: "platform",
    actorId: user.userId,
    type,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "rapid_iq_intel",
    resourceId,
  });
}

function filterOpportunities(
  rows: RapidIqIntelOpportunity[],
  q: Record<string, string | undefined> | undefined,
): RapidIqIntelOpportunity[] {
  const market = q?.market?.trim();
  const agency = q?.agency?.trim().toLowerCase();
  const type = q?.opportunityType?.trim();
  const category = q?.category?.trim().toLowerCase();
  const recommendation = q?.recommendation?.trim();
  const status = q?.status?.trim();
  const preRfp = q?.preRfp ?? q?.preRfpSignal;
  const minFit = q?.minFit ? Number.parseFloat(q.minFit) : undefined;
  const minWin = q?.minWin ? Number.parseFloat(q.minWin) : undefined;
  const stage = q?.procurementStage ? Number.parseInt(q.procurementStage, 10) : undefined;
  const dueBefore = q?.dueBefore?.trim();
  const dueAfter = q?.dueAfter?.trim();

  return rows.filter((row) => {
    if (market && row.market !== market) return false;
    if (agency && !row.agency.toLowerCase().includes(agency)) return false;
    if (type && row.opportunityType !== type) return false;
    if (category && !row.categories.some((c) => c.toLowerCase().includes(category))) return false;
    if (recommendation && (row.userRecommendation ?? row.aiRecommendation ?? row.recommendation) !== recommendation) {
      return false;
    }
    if (status && row.status !== status) return false;
    if (preRfp === "true" && !row.preRfpSignal) return false;
    if (preRfp === "false" && row.preRfpSignal) return false;
    if (Number.isFinite(minFit) && (row.userFitScore ?? row.fitScore) < (minFit as number)) return false;
    if (Number.isFinite(minWin) && (row.userWinSignal ?? row.winSignal) < (minWin as number)) return false;
    if (Number.isFinite(stage) && (row.userProcurementStage ?? row.procurementStage) !== stage) return false;
    if (dueBefore && row.dueDate && row.dueDate > dueBefore) return false;
    if (dueAfter && row.dueDate && row.dueDate < dueAfter) return false;
    return true;
  });
}

function kpis(rows: RapidIqIntelOpportunity[], watches: number) {
  const now = Date.now();
  const in30 = now + 30 * 86_400_000;
  return {
    newOpportunities: rows.filter((r) => r.status === "NEW").length,
    highFit: rows.filter((r) => (r.userFitScore ?? r.fitScore) >= 7).length,
    preRfpSignals: rows.filter((r) => r.preRfpSignal).length,
    dueWithin30Days: rows.filter((r) => {
      if (!r.dueDate) return false;
      const t = Date.parse(r.dueDate);
      return Number.isFinite(t) && t >= now && t <= in30;
    }).length,
    estimatedPipeline: rows
      .filter((r) => r.status !== "PASSED" && r.status !== "LOST")
      .reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0),
    agenciesWatched: watches,
  };
}

export async function handleIntelHttp(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<ReturnType<typeof ok>> {
  const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
  const path = event.rawPath ?? event.requestContext.http?.path ?? "";
  const q = event.queryStringParameters ?? undefined;
  const intelId = intelIdFromPath(path, event.pathParameters);
  const watchId = watchIdFromPath(path, event.pathParameters);

  if (method === "GET" && (path.endsWith("/intel/opportunities") || path.endsWith("/intel/opportunities/"))) {
    const [rows, watches] = await Promise.all([listIntelOpportunities(200), listIntelWatches()]);
    const filtered = filterOpportunities(rows, q).sort(
      (a, b) => intelStrategicPriority(b) - intelStrategicPriority(a),
    );
    return ok({ items: filtered, kpis: kpis(rows, watches.filter((w) => w.enabled).length) });
  }

  if (method === "POST" && (path.endsWith("/intel/opportunities") || path.endsWith("/intel/opportunities/"))) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = rapidIqIntelManualIngestBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const fetched = await fetchIngestText(parsed.data.url);
    if (!fetched.ok) return badRequest("Could not retrieve source URL");
    const watch = parsed.data.watchId ? await getIntelWatch(parsed.data.watchId) : null;
    const doc = sourceDocumentFromManual({
      url: parsed.data.url,
      title: parsed.data.agency ?? watch?.agency ?? "Manual ingest",
      text: stripHtml(fetched.body).slice(0, 24_000),
      agency: parsed.data.agency ?? watch?.agency,
      watchId: parsed.data.watchId,
    });
    const market = parsed.data.market ?? watch?.market ?? "TRANSIT";
    const analyzed = await analyzeOpportunity(doc, market);
    const { opportunity } = await upsertIntelOpportunity({
      doc,
      extraction: analyzed.result,
      market,
      modelUsed: analyzed.model,
      watchId: parsed.data.watchId,
    });
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_ANALYZED, opportunity.id, {
      sourceUrl: opportunity.sourceUrl,
      fitScore: opportunity.fitScore,
    });
    return ok({ opportunity });
  }

  if (method === "GET" && (path.endsWith("/intel/rfp-counts") || path.endsWith("/intel/rfp-counts/"))) {
    const snapshot = await getRfpCountSnapshot();
    return ok({ snapshot });
  }

  if (method === "GET" && (path.endsWith("/intel/watches") || path.endsWith("/intel/watches/"))) {
    await seedDefaultIntelWatches();
    const watches = await listIntelWatches();
    return ok({ watches, defaultMarket: "all", total: watches.length });
  }

  if (method === "POST" && (path.endsWith("/intel/watches") || path.endsWith("/intel/watches/"))) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = createRapidIqIntelWatchBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const now = new Date().toISOString();
    const watch = {
      id: makeId("watch"),
      name: parsed.data.name,
      agency: parsed.data.agency,
      market: parsed.data.market ?? "TRANSIT",
      enabled: parsed.data.enabled ?? true,
      keywords: parsed.data.keywords?.length ? parsed.data.keywords : defaultTransitWatchKeywords(),
      sourceDomains: parsed.data.sourceDomains ?? [],
      sourceUrls: parsed.data.sourceUrls ?? [],
      minimumFitScore: parsed.data.minimumFitScore ?? 7,
      preRfpFloor: parsed.data.preRfpFloor,
      webSearchEnabled: parsed.data.webSearchEnabled,
      region: parsed.data.region,
      notes: parsed.data.notes,
      createdAt: now,
      updatedAt: now,
    };
    await putIntelWatch(watch);
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_WATCH_UPDATED, watch.id, { action: "create" });
    return ok({ watch });
  }

  if (watchId && path.includes("/intel/watches/")) {
    if (method === "PATCH") {
      const body = parseBody(event);
      if (body === null) return badRequest("Invalid JSON");
      const parsed = patchRapidIqIntelWatchBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const watch = await updateIntelWatchFields(watchId, parsed.data);
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_WATCH_UPDATED, watchId, parsed.data);
      return ok({ watch });
    }
    if (method === "POST" && path.endsWith("/run")) {
      const queued = await enqueueIntelWatchJob(watchId);
      const summary = queued ? { queued: true } : await processWatch(watchId);
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_WATCH_RUN, watchId, { queued });
      return ok(summary);
    }
    if (method === "GET") {
      const watch = await getIntelWatch(watchId);
      if (!watch) return notFound("Watch not found");
      return ok({ watch });
    }
  }

  if (!intelId) return notFound("Not found");

  const existing = await getIntelOpportunity(intelId);
  if (!existing) return notFound("Opportunity not found");

  if (method === "GET") {
    return ok({ opportunity: existing });
  }

  if (method === "PATCH") {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = patchRapidIqIntelOpportunityBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const updated = await updateIntelOpportunityFields(intelId, parsed.data);
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_UPDATED, intelId, parsed.data);
    return ok({ opportunity: updated });
  }

  if (method === "POST" && path.endsWith("/analyze")) {
    const fetched = await fetchIngestText(existing.sourceUrl);
    const doc = sourceDocumentFromManual({
      url: existing.sourceUrl,
      title: existing.title,
      text: fetched.ok ? stripHtml(fetched.body).slice(0, 24_000) : `${existing.title}\n${existing.reason}`,
      agency: existing.agency,
      watchId: existing.watchId,
    });
    const watch = existing.watchId ? await getIntelWatch(existing.watchId) : null;
    if (watch) {
      const row = await processSourceDocument({ doc, watch });
      const opportunity = row ?? existing;
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_ANALYZED, intelId, {
        fitScore: opportunity.fitScore,
        model: opportunity.modelUsed,
      });
      return ok({ opportunity });
    }
    const analyzed = await analyzeOpportunity(doc, existing.market);
    const { opportunity } = await upsertIntelOpportunity({
      doc,
      extraction: analyzed.result,
      market: existing.market,
      modelUsed: analyzed.model,
      watchId: existing.watchId,
    });
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_ANALYZED, intelId, {
      fitScore: opportunity.fitScore,
      model: analyzed.model,
    });
    return ok({ opportunity });
  }

  if (method === "POST" && path.endsWith("/pursuit-brief")) {
    const generated = await generatePursuitBrief(existing);
    if (!generated) return badRequest("Could not generate pursuit brief");
    const updated = await updateIntelOpportunityFields(intelId, {
      pursuitBrief: JSON.stringify(generated.result),
    });
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_PURSUIT_BRIEF, intelId, {
      model: generated.model,
    });
    return ok({ brief: generated.result, opportunity: updated, model: generated.model });
  }

  if (method === "POST" && path.endsWith("/outreach")) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = rapidIqIntelOutreachBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const generated = await generateOutreach(existing, parsed.data.audience);
    if (!generated) return badRequest("Could not generate outreach");
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_OUTREACH, intelId, {
      audience: parsed.data.audience,
      model: generated.model,
    });
    return ok({ text: generated.text, audience: parsed.data.audience, model: generated.model });
  }

  if (method === "POST" && path.endsWith("/bid-no-bid")) {
    const generated = await generateBidNoBidAnalysis(existing);
    if (!generated) return badRequest("Could not generate bid/no-bid analysis");
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_INTEL_BID_NO_BID, intelId, {
      recommendation: generated.result.recommendation,
      model: generated.model,
    });
    return ok({ analysis: generated.result, model: generated.model });
  }

  return badRequest("Method not allowed");
}
