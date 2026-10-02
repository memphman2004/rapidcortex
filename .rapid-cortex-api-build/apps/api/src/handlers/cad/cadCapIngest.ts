import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { parseCapXml, normalizeCapAlert, shouldProcessAlert } from "../../lib/cad/cap/cap-parser.js";
import {
  loadAgencyCapConfig,
  markCapDedup,
  resolveCapIntegrationId,
  routeFipsCodes,
  validateCapToken,
} from "../../lib/cad/cap/cap-fips-router.js";
import type {
  CadCapRecord,
  CapIngestStatus,
  NormalizedCapIncident,
} from "../../lib/cad/cap/cap-types.js";
import { env } from "../../lib/env.js";
import { ddb } from "../../repositories/baseRepository.js";
import type { CadWebhookIngressMessage } from "../../services/cad/cadWebhookProcessService.js";

const sns = new SNSClient({ region: env.region });

const DEDUP_TTL_DAYS = 7;
const CAP_RECORD_TTL_DAYS = 30;

function nowTtl(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

function okResponse(body: Record<string, unknown>, status = 200) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function errorResponse(status: number, message: string) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: false, error: message }),
  };
}

function capTokenFromHeaders(headers: Record<string, string | undefined>): string | undefined {
  return headers["x-rc-cap-token"] ?? headers["X-RC-Cap-Token"];
}

async function checkAndMarkDedup(
  agencyId: string,
  capIdentifier: string,
  capSender: string,
): Promise<boolean> {
  const table = env.cadWebhookIdempotencyTable?.trim();
  if (!table) return false;
  const dedupeKey = `cap:${agencyId}:${capSender}:${capIdentifier}`;
  return markCapDedup(table, dedupeKey, nowTtl(DEDUP_TTL_DAYS));
}

async function writeCapRecord(record: CadCapRecord): Promise<void> {
  const table = env.cadCapIncidentsTable?.trim();
  if (!table) return;
  try {
    await ddb.send(new PutCommand({ TableName: table, Item: record }));
  } catch (e) {
    console.warn("[cap-ingest] CadCapIncidentsTable write failed:", (e as Error).message);
  }
}

function buildWebhookPayload(incident: NormalizedCapIncident): Record<string, unknown> {
  return {
    cadNumber: `CAP#${incident.capIdentifier}`,
    incidentType: incident.incidentType,
    priority: incident.priority,
    location: incident.areaDesc || "Unknown",
    notes: [incident.headline, incident.description, incident.instruction].filter(Boolean).join("\n\n"),
    capMsgType: incident.msgType,
    capUpdates: incident.updatesIdentifiers,
  };
}

async function publishToSns(agencyId: string, incident: NormalizedCapIncident): Promise<void> {
  const topic = env.cadWebhookIngressTopicArn?.trim();
  if (!topic) return;

  const integrationId = await resolveCapIntegrationId(agencyId);
  if (!integrationId) {
    console.warn(`[cap-ingest] no cap_inbound integration for ${agencyId} — skipping SNS`);
    return;
  }

  const msg: CadWebhookIngressMessage = {
    v: 1,
    agencyId,
    integrationId,
    rawBody: JSON.stringify(buildWebhookPayload(incident)),
    receivedAt: incident.receivedAt,
    contentType: "application/json",
  };

  await sns.send(
    new PublishCommand({
      TopicArn: topic,
      Message: JSON.stringify(msg),
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const receivedAt = new Date().toISOString();
  const agencyId = event.pathParameters?.agencyId ?? "";

  if (!agencyId) return errorResponse(400, "Missing agencyId in path");

  const contentType = event.headers["content-type"] ?? event.headers["Content-Type"] ?? "";
  const isXml =
    contentType.includes("xml") ||
    contentType.includes("text/plain") ||
    contentType.includes("application/octet-stream");

  if (!isXml && event.body) {
    const bodyStart = (event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body
    ).trimStart();
    if (
      !bodyStart.startsWith("<?xml") &&
      !bodyStart.startsWith("<alert") &&
      !bodyStart.includes("<alert")
    ) {
      return errorResponse(415, "Expected CAP 1.2 XML body");
    }
  }

  const rawXml = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");

  if (!rawXml.trim()) return errorResponse(400, "Empty request body");

  const parseResult = parseCapXml(rawXml);
  if (!parseResult.ok) {
    console.warn(`[cap-ingest] ${agencyId} parse error: ${parseResult.error}`);
    await writeCapRecord({
      agencyId: agencyId === "auto" || agencyId === "fips" ? "unrouted" : agencyId,
      sk: `${receivedAt}#PARSE_ERROR`,
      capIdentifier: "unknown",
      capSender: "unknown",
      capSentAt: receivedAt,
      status: "parse_error",
      msgType: "Alert",
      capStatus: "System",
      fipsCodes: [],
      headline: "Parse error",
      incidentType: "parse_error",
      priority: "P4",
      areaDesc: "",
      rawXml: rawXml.slice(0, 10_000),
      receivedAt,
      ttl: nowTtl(CAP_RECORD_TTL_DAYS),
    });
    return errorResponse(400, `CAP parse error: ${parseResult.error}`);
  }

  const { alert } = parseResult;

  const validation = shouldProcessAlert(alert, {
    acceptExercise: env.capAcceptExercise,
    acceptTest: env.capAcceptTest,
  });

  if (!validation.shouldProcess) {
    console.log(`[cap-ingest] ${agencyId} skip: ${validation.skipReason}`);
    await writeCapRecord({
      agencyId: agencyId === "auto" || agencyId === "fips" ? "unrouted" : agencyId,
      sk: `${receivedAt}#${alert.identifier}`,
      capIdentifier: alert.identifier,
      capSender: alert.sender,
      capSentAt: alert.sent,
      status: "skipped",
      msgType: alert.msgType,
      capStatus: alert.status,
      fipsCodes: [],
      headline: alert.infos[0]?.headline ?? alert.identifier,
      incidentType: alert.infos[0]?.event ?? "unknown",
      priority: "P4",
      areaDesc: alert.infos[0]?.areas[0]?.areaDesc ?? "",
      rawXml,
      receivedAt,
      ttl: nowTtl(CAP_RECORD_TTL_DAYS),
    });
    return okResponse({ ok: true, status: "skipped", reason: validation.skipReason });
  }

  const incident = normalizeCapAlert(alert, "cap_direct");
  const capToken = capTokenFromHeaders(event.headers);

  let targetAgencies: string[];

  if (agencyId === "auto" || agencyId === "fips") {
    const routing = await routeFipsCodes(incident.fipsCodes);
    if (routing.matches.length === 0) {
      console.log(`[cap-ingest] no agency matched FIPS: ${incident.fipsCodes.join(",")}`);
      await writeCapRecord({
        agencyId: "unrouted",
        sk: `${receivedAt}#${alert.identifier}`,
        capIdentifier: alert.identifier,
        capSender: alert.sender,
        capSentAt: alert.sent,
        status: "no_agency",
        msgType: alert.msgType,
        capStatus: alert.status,
        fipsCodes: incident.fipsCodes,
        headline: incident.headline,
        incidentType: incident.incidentType,
        priority: incident.priority,
        areaDesc: incident.areaDesc,
        rawXml,
        receivedAt,
        ttl: nowTtl(CAP_RECORD_TTL_DAYS),
      });
      return okResponse({ ok: true, status: "no_agency", fipsCodes: incident.fipsCodes });
    }

    const primaryConfig = routing.matches[0];
    if (!validateCapToken(primaryConfig, capToken)) {
      return errorResponse(401, "Invalid or missing X-RC-Cap-Token");
    }

    targetAgencies = routing.matches.map((m) => m.agencyId);
  } else {
    const agencyConfig = await loadAgencyCapConfig(agencyId);
    if (agencyConfig && !validateCapToken(agencyConfig, capToken)) {
      return errorResponse(401, "Invalid or missing X-RC-Cap-Token");
    }
    targetAgencies = [agencyId];
  }

  const published: string[] = [];
  const deduped: string[] = [];

  for (const targetAgencyId of targetAgencies) {
    const isDupe = await checkAndMarkDedup(targetAgencyId, alert.identifier, alert.sender);
    const recordStatus: CapIngestStatus = isDupe ? "duplicate" : "routed";

    await writeCapRecord({
      agencyId: targetAgencyId,
      sk: `${receivedAt}#${alert.identifier}`,
      capIdentifier: alert.identifier,
      capSender: alert.sender,
      capSentAt: alert.sent,
      status: recordStatus,
      msgType: alert.msgType,
      capStatus: alert.status,
      fipsCodes: incident.fipsCodes,
      headline: incident.headline,
      incidentType: incident.incidentType,
      priority: incident.priority,
      areaDesc: incident.areaDesc,
      rawXml,
      receivedAt,
      ttl: nowTtl(CAP_RECORD_TTL_DAYS),
    });

    if (isDupe) {
      console.log(`[cap-ingest] duplicate: ${alert.identifier} for ${targetAgencyId}`);
      deduped.push(targetAgencyId);
      continue;
    }

    try {
      await publishToSns(targetAgencyId, { ...incident, routedAgencyId: targetAgencyId });
      published.push(targetAgencyId);
      console.log(
        `[cap-ingest] published ${alert.identifier} → ${targetAgencyId} (${incident.incidentType}, ${incident.priority})`,
      );
    } catch (e) {
      console.error(`[cap-ingest] SNS publish failed for ${targetAgencyId}:`, (e as Error).message);
    }
  }

  return okResponse(
    {
      ok: true,
      status: "processed",
      identifier: alert.identifier,
      msgType: alert.msgType,
      priority: incident.priority,
      publishedTo: published,
      deduplicatedFor: deduped,
      fipsCodes: incident.fipsCodes,
    },
    202,
  );
};
