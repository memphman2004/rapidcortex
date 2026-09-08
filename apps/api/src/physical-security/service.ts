import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type {
  OpenIncidentForCorrelation,
  PhysicalSecurityEvent,
  PhysicalSecurityIngestBody,
  TransitIncident,
} from "rapid-cortex-shared";
import {
  PHYSICAL_EVENT_TO_BADGE,
  correlateOpenIncidentsInZone,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { broadcastToAgency } from "../lib/websocket/send-message.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { resolveCampusAgencyId } from "../campus/campus-access.js";
import { createCampusQrIncident, listCampusIncidents } from "../campus/campus-incident-service.js";
import { resolveVenueAgencyId } from "../venue/venue-access.js";
import { createVenuePhysicalIncident, listVenueIncidents } from "../venue/venue-incident-service.js";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../repositories/baseRepository.js";
import { TRANSIT_TABLE_ENV, transitTableEnv } from "../transit/tables.js";
import { physicalSecurityStore } from "./store.js";

const auditRepo = new AuditRepository();
const agencies = new AgencyRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function clip(value: string | undefined, max: number): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

async function resolveTransitAgencyId(slug: string): Promise<string | null> {
  const code = slug.trim().toUpperCase().replace(/-/g, "");
  if (!code) return null;
  const lower = slug.trim().toLowerCase();
  const candidates = [`test-transit-${lower}`, `transit-${lower}`, `last-transit-${lower}`];
  for (const id of candidates) {
    const hit = await agencies.get(id);
    if (hit) return id;
  }
  const ids = await agencies.listAgencyIds();
  return (
    ids.find((id) => {
      const match = id.match(/(?:test-)?transit-(.+)$/i);
      const extracted = (match?.[1] ?? id).toUpperCase().replace(/-/g, "");
      return extracted === code;
    }) ?? null
  );
}

export async function ingestPhysicalSecurityEvent(
  body: PhysicalSecurityIngestBody,
): Promise<{ event: PhysicalSecurityEvent; incidentId?: string }> {
  if (!env.enablePhysicalSecurityIngest) throw Object.assign(new Error("FEATURE_DISABLED"), { statusCode: 404 });
  if (!env.physicalSecurityTable) throw Object.assign(new Error("TABLE_UNSET"), { statusCode: 503 });

  let agencyId: string | null = null;
  if (body.vertical === "campus") agencyId = await resolveCampusAgencyId(body.agencySlug);
  else if (body.vertical === "venue") agencyId = await resolveVenueAgencyId(body.agencySlug);
  else agencyId = await resolveTransitAgencyId(body.agencySlug);
  if (!agencyId) throw Object.assign(new Error("TENANT_NOT_FOUND"), { statusCode: 404 });

  const occurredAt = body.occurredAt ?? nowIso();
  const mapBadge = PHYSICAL_EVENT_TO_BADGE[body.eventType];
  const description =
    body.description?.trim() ||
    `Physical security ${body.eventType.replaceAll("_", " ")} at ${body.zoneCode}`;

  let open: OpenIncidentForCorrelation[] = [];
  let incidentId: string | undefined;

  if (body.vertical === "campus") {
    const campusCode = body.agencySlug.trim().toUpperCase();
    const listed = await listCampusIncidents({ campusCode, status: ["open", "assigned", "responding"], limit: 50 });
    open = listed.incidents.map((i) => ({
      incidentId: i.id,
      zoneCode: i.zoneCode ?? i.buildingCode,
      buildingCode: i.buildingCode,
      status: i.status,
      createdAt: i.createdAt,
    }));
    const created = await createCampusQrIncident(
      {
        campusCode,
        buildingCode: clip(body.buildingCode, 50) || clip(body.zoneCode, 50) || "CAMPUS",
        zoneCode: clip(body.zoneCode, 16),
        roomCode: clip(body.zoneCode, 20) ?? "",
        type: body.eventType === "fire_alarm" || body.eventType === "panel_alarm" ? "active_threat" : "security",
        source: "physical_security",
        description: `[Physical Security · ${mapBadge}] ${description}`,
        isAnonymous: true,
        confidential: false,
      },
      agencyId,
      "physical-security-ingest",
    );
    incidentId = created.incident.id;
  } else if (body.vertical === "venue") {
    const venueCode = body.agencySlug.trim().toUpperCase();
    const listed = await listVenueIncidents({
      venueCode,
      agencyId,
      status: ["open", "assigned", "responding"],
      limit: 50,
    });
    open = listed.incidents.map((i) => ({
      incidentId: i.id,
      zoneCode: i.zoneCode,
      status: i.status,
      createdAt: i.createdAt,
    }));
    const created = await createVenuePhysicalIncident({
      venueCode,
      agencyId,
      zoneCode: body.zoneCode,
      locationName: body.buildingCode || body.zoneCode,
      description: `[Physical Security · ${mapBadge}] ${description}`,
      building: body.buildingCode,
    });
    incidentId = created.incident.incidentId;
  } else if (process.env.TRANSIT_INCIDENTS_TABLE?.trim()) {
    const out = await ddb.send(
      new QueryCommand({
        TableName: transitTableEnv(TRANSIT_TABLE_ENV.incidents),
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
      }),
    );
    const incidents = (out.Items ?? []) as TransitIncident[];
    open = incidents.map((i) => ({
      incidentId: i.incidentId,
      zoneCode: i.stationId ?? i.vehicleId ?? i.routeId,
      status: i.status,
      createdAt: i.createdAt,
    }));
    const createdAt = nowIso();
    const item: TransitIncident = {
      agencyId,
      incidentId: makeId("tinc"),
      type: "security",
      status: "open",
      summary: `[Physical Security · ${mapBadge}] ${description}`.slice(0, 500),
      vehicleId: body.zoneCode.startsWith("VEH") ? body.zoneCode : undefined,
      stationId: body.buildingCode || body.zoneCode,
      escalatedTo911: false,
      source: "physical_security",
      createdByUserId: "physical-security-ingest",
      createdAt,
      updatedAt: createdAt,
    };
    await ddb.send(new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.incidents), Item: item }));
    incidentId = item.incidentId;
    await broadcastToAgency({
      agencyId,
      message: { type: "transit.incident.created", data: { incidentId: item.incidentId } },
    });
  }

  const correlatedIncidentIds = correlateOpenIncidentsInZone(open, body.zoneCode, new Date(occurredAt)).filter(
    (id) => id !== incidentId,
  );

  const event: PhysicalSecurityEvent = {
    eventId: makeId("physevt"),
    agencyId,
    vertical: body.vertical,
    siteCode: body.agencySlug.trim().toUpperCase(),
    providerId: body.providerId ?? "generic-webhook",
    eventType: body.eventType,
    mapBadge,
    zoneCode: body.zoneCode,
    buildingCode: body.buildingCode,
    description,
    occurredAt,
    vendorEventId: body.vendorEventId,
    incidentId,
    correlatedIncidentIds,
    createdAt: nowIso(),
  };
  await physicalSecurityStore.putEvent(event);
  await physicalSecurityStore.putZoneBadge({
    agencyId,
    zoneCode: body.zoneCode,
    mapBadge,
    eventId: event.eventId,
    updatedAt: event.createdAt,
  });

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: "physical-security-ingest",
    type: AUDIT_EVENT_TYPES.PHYSICAL_EVENT_INGESTED,
    details: {
      eventType: body.eventType,
      zoneCode: body.zoneCode,
      mapBadge,
      incidentId,
      correlatedIncidentIds,
      vendorEventId: body.vendorEventId,
    },
    createdAt: event.createdAt,
    resourceType: "incident",
    resourceId: incidentId ?? event.eventId,
  });

  await broadcastToAgency({
    agencyId,
    message: {
      type: "PHYSICAL_SECURITY_EVENT",
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        mapBadge,
        zoneCode: event.zoneCode,
        buildingCode: event.buildingCode,
        incidentId,
        correlatedIncidentIds,
        source: "physical_security",
      },
    },
  });

  return { event, incidentId };
}

export async function listPhysicalSecurityStatus(agencyId: string) {
  if (!env.enablePhysicalSecurityIngest) throw Object.assign(new Error("FEATURE_DISABLED"), { statusCode: 404 });
  const [badges, events] = await Promise.all([
    physicalSecurityStore.listZoneBadges(agencyId),
    physicalSecurityStore.listRecentEvents(agencyId, 25),
  ]);
  return { badges, events };
}
