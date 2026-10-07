import { createHash } from "node:crypto";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { CadVendor } from "rapid-cortex-shared";
import type { Incident } from "rapid-cortex-shared";
import { normalizeAddressForIndex } from "rapid-cortex-shared";
import { getCadParser } from "../../lib/cad/parsers/index.js";
import type { NormalizedCadIncident } from "../../lib/cad/types.js";
import { env } from "../../lib/env.js";
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
        call_number: `RC-TEST-${Date.now()}`,
        call_type: "TEST",
        location_text: "1 Test St",
        priority: "P3",
        apparatus: [],
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
): Incident {
  const incidentId = makeId("inc");
  const callerAddressLine = n.location || null;
  const callerAddressNormalized = callerAddressLine ? normalizeAddressForIndex(callerAddressLine) : null;
  const incident: Incident = {
    incidentId,
    agencyId,
    title: n.incidentType || `CAD ${n.cadNumber}`,
    callerAddressLine,
    callerAddressNormalized: callerAddressNormalized && callerAddressNormalized.length > 0 ? callerAddressNormalized : null,
    category: "unknown",
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
    cadLocation: n.location,
    cadUnits: n.units ?? [],
    cadCoordinates: n.coordinates,
    cadDedupeKey: stableCadKey,
    cadCallerName: n.callerName?.trim() ? n.callerName.trim() : null,
    cadCallerCallbackMasked: maskCallback(n.callerCallback),
    confidence: null,
    escalationFlag: false,
    summary: n.notes || "",
    createdAt: now,
    updatedAt: now,
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
  const payloadForParser =
    integration.vendor === "generic_webhook" ?
      {
        ...(typeof parsedUnknown === "object" && parsedUnknown !== null ? (parsedUnknown as object) : {}),
        fieldMapping: integration.config?.fieldMapping,
      }
    : parsedUnknown;

  let activeRawId = msg.existingRawRecordId;

  if (!parser.validate(payloadForParser)) {
    if (!activeRawId) {
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
      await rawRepo.updateStatus(activeRawId, { status: "error", errorMessage: "payload_validation_failed" });
    }
    return;
  }

  const normalized = parser.parse(payloadForParser);
  const vendorRevKey = normalized.revision !== undefined ? String(normalized.revision) : "n";
  const deterministicRawId = `raw#${msg.agencyId}#${normalized.cadNumber}#${vendorRevKey}`;

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
      return;
    }
    activeRawId = deterministicRawId;
    await rawRepo.updateStatus(activeRawId, { status: "processing" });
  }

  const stableCadKey = integrationCadKey(msg.integrationId, normalized.cadNumber);
  let existing =
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
      return;
    }

    const nextCadRevision = (existing.cadRevision ?? 0) + 1;
    const nextVendorRev =
      normalized.revision !== undefined ?
        Math.max(prevVendor, normalized.revision)
      : (existing.cadVendorRevisionLast ?? null);

    const callerAddressLine = normalized.location || existing.callerAddressLine || null;
    const callerAddressNormalized = callerAddressLine ? normalizeAddressForIndex(callerAddressLine) : null;
    const mergedSummary = normalized.notes || existing.summary || "";

    await incidentRepo.patchFromCadIngest(existing.incidentId, {
      cadRevision: nextCadRevision,
      cadVendorRevisionLast: nextVendorRev ?? null,
      cadLastSyncAt: now,
      cadStatus: normalized.cadStatus ?? null,
      cadUnits: normalized.units?.length ? normalized.units : existing.cadUnits ?? [],
      callerAddressLine,
      callerAddressNormalized: callerAddressNormalized && callerAddressNormalized.length > 0 ? callerAddressNormalized : null,
      urgency: priorityToUrgency(normalized.priority),
      title: normalized.incidentType || existing.title,
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
        callerCallbackMasked: normalized.callerCallback ? maskTail(normalized.callerCallback) : undefined,
      },
      createdAt: now,
      resourceType: "integration",
      resourceId: msg.integrationId,
    });

    if (msg.idempotencyKey?.trim()) {
      const idemRepo = new CadWebhookIdempotencyRepository();
      const key = idempotencyDedupeKey(msg.agencyId, msg.integrationId, msg.idempotencyKey.trim());
      const ttlIdem = Math.floor(Date.now() / 1000) + 600;
      await idemRepo.put({
        dedupeKey: key,
        responseJson: JSON.stringify({ ok: true, incidentId: existing.incidentId, action: "updated" }),
        ttl: ttlIdem,
      });
    }
    return;
  }

  const incident = newCadIncident(msg.agencyId, normalized, integration, rawBody, stableCadKey, now);
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
      callerCallbackMasked: normalized.callerCallback ? maskTail(normalized.callerCallback) : undefined,
    },
    createdAt: now,
    resourceType: "integration",
    resourceId: msg.integrationId,
  });

  if (msg.idempotencyKey?.trim()) {
    const idemRepo = new CadWebhookIdempotencyRepository();
    const key = idempotencyDedupeKey(msg.agencyId, msg.integrationId, msg.idempotencyKey.trim());
    const ttlIdem = Math.floor(Date.now() / 1000) + 600;
    await idemRepo.put({
      dedupeKey: key,
      responseJson: JSON.stringify({ ok: true, incidentId: incident.incidentId, action: "created" }),
      ttl: ttlIdem,
    });
  }
}
