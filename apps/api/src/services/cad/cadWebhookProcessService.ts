import { createHash } from "node:crypto";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { CadVendor } from "rapid-cortex-shared";
import type { Incident } from "rapid-cortex-shared";
import { normalizeAddressForIndex } from "rapid-cortex-shared";
import { extractCadIncidentRecords, getCadParser } from "../../lib/cad/parsers/index.js";
import { asRecord } from "../../lib/cad/parsers/parse-helpers.js";
import { mergeCadExtras, resolveCadIngestIntelligence } from "../../lib/cad/cad-ingest-intelligence.js";
import type { CadParser } from "../../lib/cad/types.js";
import type { NormalizedCadIncident } from "../../lib/cad/types.js";
import { env } from "../../lib/env.js";
import { incidentTimelineLogger } from "../../lib/incidentTimelineLogger.js";
import { buildIncidentDedupe, buildRetentionFields } from "../../lib/retentionPolicy.js";
import { makeId } from "../../lib/ids.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CadIncidentRawRepository } from "../../repositories/cadIncidentRawRepository.js";
import { CadIntegrationRepository, type CadIntegrationRecord } from "../../repositories/cadIntegrationRepository.js";
import { CadWebhookIdempotencyRepository } from "../../repositories/cadWebhookIdempotencyRepository.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";
import { tryConsumeCadWebhookRateSlot } from "./cadWebhookRateLimiter.js";

const sns = new SNSClient({ region: env.region });
const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const integrationRepo = new CadIntegrationRepository();
const incidentRepo = new IncidentRepository();
const rawRepo = new CadIncidentRawRepository();

export type CadWebhookIngressMessage = {
  v: 1;
  agencyId: string;
  integrationId: string;
  rawBody: string;
  receivedAt: string;
  /** Original Content-Type header from inbound webhook (for XML detection). */
  contentType?: string;
  idempotencyKey?: string;
  internalSelfTest?: boolean;
  /** Legacy SQS path: raw row already exists with this id. */
  existingRawRecordId?: string;
};

export type CadWebhookQueueMessage = {
  rawId: string;
  agencyId: string;
  integrationId: string;
  internalSelfTest?: boolean;
};

function maskTail(value: string, keep = 4): string {
  if (value.length <= keep) return "****";
  return `…${value.slice(-keep)}`;
}

function maskCallback(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const d = value.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

function idempotencyDedupeKey(agencyId: string, integrationId: string, idem: string): string {
  const h = createHash("sha256")
    .update(`${agencyId}:${integrationId}:${idem}`, "utf8")
    .digest("hex")
    .slice(0, 40);
  return `idem:${agencyId}:${h}`;
}

function vendorToCadSystem(v: CadVendor): NonNullable<Incident["cadSystem"]> {
  switch (v) {
    case "motorola_premier_one":
      return "motorola";
    case "tyler_new_world":
      return "tyler";
    case "central_square":
      return "centralsquare";
    case "hexagon":
      return "hexagon";
    case "console_one":
      return "generic";
    case "generic_webhook":
    default:
      return "generic";
  }
}

function priorityToUrgency(p: NormalizedCadIncident["priority"]): Incident["urgency"] {
  if (p === "P1") return "critical";
  if (p === "P2") return "high";
  if (p === "P4") return "low";
  return "moderate";
}

function integrationCadKey(integrationId: string, cadNumber: string): string {
  return `${integrationId}:${cadNumber}`;
}

async function resolveRelatedIncidentIds(
  agencyId: string,
  cadNumbers: string[],
  selfCadNumber: string,
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of cadNumbers.slice(0, 8)) {
    const n = raw.trim();
    if (!n || n === selfCadNumber || seen.has(n)) continue;
    seen.add(n);
    const found = await incidentRepo.findByCadIncidentId(agencyId, n);
    if (found) ids.push(found.incidentId);
  }
  return ids;
}

async function emitCadSyncedTimeline(args: {
  incidentId: string;
  agencyId: string;
  action: "created" | "updated";
  normalized: NormalizedCadIncident;
  mappedTypeId: string | null;
}): Promise<void> {
  try {
    await incidentTimelineLogger.emit({
      incidentId: args.incidentId,
      agencyId: args.agencyId,
      kind: "cad_synced",
      source: "cad",
      payload: {
        summary: `CAD ${args.action} ${args.normalized.cadNumber}`,
        cadNumber: args.normalized.cadNumber,
        action: args.action,
        natureCode: args.normalized.incidentType,
        location: args.normalized.location,
        units: args.normalized.units.slice(0, 20),
        mappedTypeId: args.mappedTypeId,
      },
    });
  } catch {
    /* timeline is best-effort — ingest must not fail closed */
  }
}

async function persistCadMappedSop(
  incidentId: string,
  overlay: ReturnType<typeof resolveCadIngestIntelligence>["sopOverlay"],
): Promise<void> {
  if (!overlay) return;
  await incidentRepo.updateSopProtocolOverlay(incidentId, overlay);
}

function buildSelfTestPayload(vendor: CadVendor): unknown {
  switch (vendor) {
    case "motorola_premier_one":
      return {
        IncidentNumber: `RC-TEST-${Date.now()}`,
        NatureCode: "TEST",
        Location: "1 Test St",
        Priority: "P3",
        Units: [],
        CallerInfo: { Name: "Rapid Cortex", Callback: "5550100" },
      };
    case "tyler_new_world":
      return {
        eventNumber: `RC-TEST-${Date.now()}`,
        call_number: `RC-TEST-${Date.now()}`,
        call_type: "TEST",
        location_text: "1 Test St",
        priority: "P3",
        apparatus: [],
      };
    case "central_square":
      return {
        IncidentId: `RC-TEST-${Date.now()}`,
        IncidentNumber: `RC-TEST-${Date.now()}`,
        NatureOfCall: "TEST",
        Address: "1 Test St",
        Priority: "P3",
        UnitList: [],
        CallerName: "Rapid Cortex",
        CallerPhone: "5550100",
      };
    default:
      return {
        cadNumber: `RC-TEST-${Date.now()}`,
        incidentType: "TEST",
        priority: "P3",
        location: "1 Test St",
        units: [],
      };
  }
}

const MAX_WEBHOOK_BATCH = 200;

function decorateParserPayload(record: unknown, fieldMapping: unknown): unknown {
  if (!fieldMapping) return record;
  const rec = asRecord(record);
  if (!rec) return record;
  return { ...rec, fieldMapping };
}

function webhookRecordsForParser(parsedUnknown: unknown, parser: CadParser, fieldMapping: unknown): unknown[] {
  const extracted = extractCadIncidentRecords(parsedUnknown);
  const candidates = extracted.length > 0 ? extracted : [parsedUnknown];
  return candidates.map((r) => decorateParserPayload(r, fieldMapping)).filter((r) => parser.validate(r)).slice(0, MAX_WEBHOOK_BATCH);
}

async function ingestNormalizedCadIncident(args: {
  msg: CadWebhookIngressMessage;
  integration: CadIntegrationRecord;
  normalized: NormalizedCadIncident;
  rawBody: string;
  now: string;
  ttlSec: number;
  existingRawId?: string;
}): Promise<{ incidentId: string; action: "created" | "updated" | "stale_skip"; rawId: string } | null> {
  const { msg, integration, normalized, rawBody, now, ttlSec } = args;
  const vendorRevKey = normalized.revision !== undefined ? String(normalized.revision) : "n";
  const deterministicRawId = `raw#${msg.agencyId}#${normalized.cadNumber}#${vendorRevKey}`;
  let activeRawId = args.existingRawId;

  if (!activeRawId) {
    const inserted = await rawRepo.putIfAbsent({
      id: deterministicRawId,
      agencyId: msg.agencyId,
      integrationId: msg.integrationId,
      receivedAt: msg.receivedAt,
      rawBody,
      ...(msg.contentType ? { contentType: msg.contentType } : {}),
      status: "received",
      ttl: ttlSec,
    });
    if (!inserted.inserted) {
      return null;
    }
    activeRawId = deterministicRawId;
    await rawRepo.updateStatus(activeRawId, { status: "processing" });
  }

  const stableCadKey = integrationCadKey(msg.integrationId, normalized.cadNumber);
  const existing =
    (await incidentRepo.findByCadIncidentId(msg.agencyId, normalized.cadNumber)) ??
    (await incidentRepo.findByCadDedupeKey(stableCadKey));

  if (existing) {
    const prevVendor = existing.cadVendorRevisionLast ?? 0;
    if (normalized.revision !== undefined && prevVendor > normalized.revision) {
      await rawRepo.updateStatus(activeRawId, {
        status: "duplicate_skip",
        errorMessage: "stale_revision",
        linkedIncidentId: existing.incidentId,
      });
      return { incidentId: existing.incidentId, action: "stale_skip", rawId: activeRawId };
    }

    const nextCadRevision = (existing.cadRevision ?? 0) + 1;
    const nextVendorRev =
      normalized.revision !== undefined ?
        Math.max(prevVendor, normalized.revision)
      : (existing.cadVendorRevisionLast ?? null);

    const callerAddressLine = normalized.location || existing.callerAddressLine || null;
    const callerAddressNormalized = callerAddressLine ? normalizeAddressForIndex(callerAddressLine) : null;
    const mergedSummary = normalized.notes || existing.summary || "";
    const intel = resolveCadIngestIntelligence({
      normalized,
      config: integration.config,
      existing,
      now,
      mappingEnabled: env.enableCadNatureMapping,
    });
    const extras = mergeCadExtras(normalized, existing);
    const relatedNumbers = [
      ...(extras.cadRelatedCadNumbers ?? []),
      ...(extras.cadDuplicateOfCadNumber ? [extras.cadDuplicateOfCadNumber] : []),
    ];
    const cadLinkedIncidentIds = await resolveRelatedIncidentIds(
      msg.agencyId,
      relatedNumbers,
      normalized.cadNumber,
    );

    await incidentRepo.patchFromCadIngest(existing.incidentId, {
      cadRevision: nextCadRevision,
      cadVendorRevisionLast: nextVendorRev ?? null,
      cadLastSyncAt: now,
      cadStatus: normalized.cadStatus ?? null,
      cadUnits: normalized.units?.length ? normalized.units : existing.cadUnits ?? [],
      callerAddressLine,
      callerAddressNormalized: callerAddressNormalized && callerAddressNormalized.length > 0 ? callerAddressNormalized : null,
      urgency: priorityToUrgency(normalized.priority),
      title: intel.title,
      cadNatureCode: normalized.incidentType ?? null,
      cadPriority: normalized.priority,
      cadLocation: normalized.location ?? null,
      cadCoordinates: normalized.coordinates ?? existing.cadCoordinates ?? null,
      cadRawPayload: rawBody.slice(0, 450_000),
      cadCallerName: normalized.callerName?.trim() ? normalized.callerName.trim() : existing.cadCallerName ?? null,
      cadCallerCallbackMasked: maskCallback(normalized.callerCallback) ?? existing.cadCallerCallbackMasked ?? null,
      summary: mergedSummary,
      cadDedupeKey: stableCadKey,
      cadSystem: vendorToCadSystem(integration.vendor),
      cadIncidentId: normalized.cadNumber,
      source: "cad",
      ...extras,
      cadLinkedIncidentIds: cadLinkedIncidentIds.length ? cadLinkedIncidentIds : existing.cadLinkedIncidentIds ?? [],
      cadMappedIncidentTypeId: intel.mappedTypeId ?? existing.cadMappedIncidentTypeId ?? null,
      category: intel.category,
      escalationFlag: intel.escalationFlag || existing.escalationFlag ? true : undefined,
    });
    await persistCadMappedSop(existing.incidentId, intel.sopOverlay);
    await emitCadSyncedTimeline({
      incidentId: existing.incidentId,
      agencyId: msg.agencyId,
      action: "updated",
      normalized,
      mappedTypeId: intel.mappedTypeId,
    });

    await rawRepo.updateStatus(activeRawId, { status: "ok", linkedIncidentId: existing.incidentId });
    await integrationRepo.update(msg.agencyId, msg.integrationId, {
      lastIncidentAt: now,
      incrementIncidentCount: 1,
    });

    if (env.cadWebhookSnsTopicArn) {
      await sns.send(
        new PublishCommand({
          TopicArn: env.cadWebhookSnsTopicArn,
          Message: JSON.stringify({
            type: "cad.incident.received",
            agencyId: msg.agencyId,
            integrationId: msg.integrationId,
            cadIncidentId: existing.incidentId,
            cadNumber: normalized.cadNumber,
            priority: normalized.priority,
            receivedAt: now,
          }),
        }),
      );
    }

    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: msg.agencyId,
      type: AUDIT_EVENT_TYPES.CAD_INCIDENT_INGESTED,
      details: {
        integrationId: msg.integrationId,
        rawId: activeRawId,
        cadNumber: normalized.cadNumber,
        action: "updated",
        mappedTypeId: intel.mappedTypeId,
        callerCallbackMasked: normalized.callerCallback ? maskTail(normalized.callerCallback) : undefined,
      },
      createdAt: now,
      incidentId: existing.incidentId,
      resourceType: "integration",
      resourceId: msg.integrationId,
    });

    return { incidentId: existing.incidentId, action: "updated", rawId: activeRawId };
  }

  const intel = resolveCadIngestIntelligence({
    normalized,
    config: integration.config,
    existing: null,
    now,
    mappingEnabled: env.enableCadNatureMapping,
  });
  const extras = mergeCadExtras(normalized, null);
  const relatedNumbers = [
    ...(extras.cadRelatedCadNumbers ?? []),
    ...(extras.cadDuplicateOfCadNumber ? [extras.cadDuplicateOfCadNumber] : []),
  ];
  const cadLinkedIncidentIds = await resolveRelatedIncidentIds(
    msg.agencyId,
    relatedNumbers,
    normalized.cadNumber,
  );
  const incident = newCadIncident(
    msg.agencyId,
    normalized,
    integration,
    rawBody,
    stableCadKey,
    now,
    intel,
    extras,
    cadLinkedIncidentIds,
  );
  const tenant = await agencyRepo.get(msg.agencyId);
  const ret = buildRetentionFields("incident", {
    agencyConfig: tenant?.config,
    anchorIso: now,
    policyId: env.defaultRetentionPolicyId,
    dedupe: buildIncidentDedupe(incident.incidentId),
    envDefaults: env,
  });
  Object.assign(incident, { ...ret, legalHold: false });
  await incidentRepo.create(incident);
  await emitCadSyncedTimeline({
    incidentId: incident.incidentId,
    agencyId: msg.agencyId,
    action: "created",
    normalized,
    mappedTypeId: intel.mappedTypeId,
  });
  await rawRepo.updateStatus(activeRawId, { status: "ok", linkedIncidentId: incident.incidentId });
  await integrationRepo.update(msg.agencyId, msg.integrationId, {
    lastIncidentAt: now,
    incrementIncidentCount: 1,
  });

  if (env.cadWebhookSnsTopicArn) {
    await sns.send(
      new PublishCommand({
        TopicArn: env.cadWebhookSnsTopicArn,
        Message: JSON.stringify({
          type: "cad.incident.received",
          agencyId: msg.agencyId,
          integrationId: msg.integrationId,
          cadIncidentId: incident.incidentId,
          cadNumber: normalized.cadNumber,
          priority: normalized.priority,
          receivedAt: now,
        }),
      }),
    );
  }

  await auditRepo.create({
    eventId: makeId("aud"),
    agencyId: msg.agencyId,
    type: AUDIT_EVENT_TYPES.CAD_INCIDENT_INGESTED,
    details: {
      integrationId: msg.integrationId,
      rawId: activeRawId,
        cadNumber: normalized.cadNumber,
        action: "created",
        mappedTypeId: intel.mappedTypeId,
        callerCallbackMasked: normalized.callerCallback ? maskTail(normalized.callerCallback) : undefined,
      },
      createdAt: now,
      incidentId: incident.incidentId,
    resourceType: "integration",
    resourceId: msg.integrationId,
  });

  return { incidentId: incident.incidentId, action: "created", rawId: activeRawId };
}

function parseInboundPayload(rawBody: string, contentType?: string): unknown {
  const ct = (contentType ?? "").toLowerCase();
  const xmlByHeader = ct.includes("application/xml") || ct.includes("text/xml");
  const t = rawBody.trim();
  if (t.startsWith("<") || /^<\?xml/i.test(t) || xmlByHeader) {
    return { __cadXmlPayload: t };
  }
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { unstructuredPayload: rawBody };
  }
}

function newCadIncident(
  agencyId: string,
  n: NormalizedCadIncident,
  integration: CadIntegrationRecord,
  rawBody: string,
  stableCadKey: string,
  now: string,
  intel: ReturnType<typeof resolveCadIngestIntelligence>,
  extras: ReturnType<typeof mergeCadExtras>,
  cadLinkedIncidentIds: string[],
): Incident {
  const incidentId = makeId("inc");
  const callerAddressLine = n.location || null;
  const callerAddressNormalized = callerAddressLine ? normalizeAddressForIndex(callerAddressLine) : null;
  const incident: Incident = {
    incidentId,
    agencyId,
    title: intel.title,
    callerAddressLine,
    callerAddressNormalized: callerAddressNormalized && callerAddressNormalized.length > 0 ? callerAddressNormalized : null,
    category: intel.category ?? "unknown",
    urgency: priorityToUrgency(n.priority),
    status: "active",
    source: "cad",
    cadSystem: vendorToCadSystem(integration.vendor),
    cadIncidentId: n.cadNumber,
    cadRevision: 1,
    cadVendorRevisionLast: n.revision,
    cadLastSyncAt: now,
    cadRawPayload: rawBody.slice(0, 450_000),
    cadStatus: n.cadStatus,
    cadPriority: n.priority,
    cadNatureCode: n.incidentType,
    cadMappedIncidentTypeId: intel.mappedTypeId,
    cadLocation: n.location,
    cadUnits: n.units ?? [],
    cadCoordinates: n.coordinates,
    cadDedupeKey: stableCadKey,
    cadCallerName: n.callerName?.trim() ? n.callerName.trim() : null,
    cadCallerCallbackMasked: maskCallback(n.callerCallback),
    confidence: null,
    escalationFlag: Boolean(intel.escalationFlag),
    summary: n.notes || "",
    createdAt: now,
    updatedAt: now,
    ...extras,
    cadLinkedIncidentIds,
    ...(intel.sopOverlay ? { sopProtocolOverlay: intel.sopOverlay } : {}),
  };
  return incident;
}

export async function processCadWebhookQueueMessage(msg: CadWebhookQueueMessage): Promise<void> {
  const raw = await rawRepo.get(msg.rawId);
  if (!raw || raw.agencyId !== msg.agencyId) return;
  await rawRepo.updateStatus(raw.id, { status: "processing" });
  const ingress: CadWebhookIngressMessage = {
    v: 1,
    agencyId: msg.agencyId,
    integrationId: msg.integrationId,
    rawBody: raw.rawBody,
    receivedAt: raw.receivedAt,
    ...(raw.contentType ? { contentType: raw.contentType } : {}),
    internalSelfTest: msg.internalSelfTest,
    existingRawRecordId: raw.id,
  };
  await processCadWebhookIngressMessage(ingress);
}

export async function processCadWebhookIngressMessage(msg: CadWebhookIngressMessage): Promise<void> {
  const now = new Date().toISOString();
  const ttlSec = Math.floor(Date.now() / 1000) + 90 * 86_400;

  if (msg.idempotencyKey?.trim()) {
    const idemRepo = new CadWebhookIdempotencyRepository();
    const key = idempotencyDedupeKey(msg.agencyId, msg.integrationId, msg.idempotencyKey.trim());
    const cached = await idemRepo.get(key);
    if (cached?.responseJson) return;
  }

  const rate = await tryConsumeCadWebhookRateSlot(msg.integrationId);
  if (rate === "limited") {
    if (msg.existingRawRecordId) {
      await rawRepo.updateStatus(msg.existingRawRecordId, { status: "rate_limited", errorMessage: "rate_limited" });
    }
    return;
  }

  const integration = await integrationRepo.getById(msg.agencyId, msg.integrationId);
  if (!integration) {
    if (msg.existingRawRecordId) {
      await rawRepo.updateStatus(msg.existingRawRecordId, { status: "error", errorMessage: "integration_not_found" });
    }
    return;
  }

  let rawBody = msg.rawBody;
  if (msg.internalSelfTest) {
    rawBody = JSON.stringify(buildSelfTestPayload(integration.vendor));
  }

  const parsedUnknown = parseInboundPayload(rawBody, msg.contentType);
  const parser = getCadParser(integration.vendor);
  const fieldMapping = integration.config?.fieldMapping;
  const records = webhookRecordsForParser(parsedUnknown, parser, fieldMapping);

  if (records.length === 0) {
    if (!msg.existingRawRecordId) {
      const errId = makeId("raw");
      await rawRepo.put({
        id: errId,
        agencyId: msg.agencyId,
        integrationId: msg.integrationId,
        receivedAt: msg.receivedAt,
        rawBody,
        ...(msg.contentType ? { contentType: msg.contentType } : {}),
        status: "error",
        errorMessage: "payload_validation_failed",
        ttl: ttlSec,
      });
    } else {
      await rawRepo.updateStatus(msg.existingRawRecordId, { status: "error", errorMessage: "payload_validation_failed" });
    }
    return;
  }

  const results: Array<{ incidentId: string; action: string }> = [];
  for (let i = 0; i < records.length; i++) {
    const normalized = parser.parse(records[i]);
    const existingRawId = i === 0 ? msg.existingRawRecordId : undefined;
    const result = await ingestNormalizedCadIncident({
      msg,
      integration,
      normalized,
      rawBody,
      now,
      ttlSec,
      existingRawId,
    });
    if (result && result.action !== "stale_skip") {
      results.push({ incidentId: result.incidentId, action: result.action });
    }
  }

  if (msg.idempotencyKey?.trim() && results.length > 0) {
    const idemRepo = new CadWebhookIdempotencyRepository();
    const key = idempotencyDedupeKey(msg.agencyId, msg.integrationId, msg.idempotencyKey.trim());
    const ttlIdem = Math.floor(Date.now() / 1000) + 600;
    await idemRepo.put({
      dedupeKey: key,
      responseJson: JSON.stringify({
        ok: true,
        incidentId: results[0]?.incidentId,
        action: results[0]?.action,
        count: results.length,
      }),
      ttl: ttlIdem,
    });
  }
}
