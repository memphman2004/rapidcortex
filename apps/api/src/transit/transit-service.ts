import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import {
  transitAlertLevelPatchSchema,
  transitBroadcastBodySchema,
  transitIncidentCreateBodySchema,
  transitIncidentPatchBodySchema,
  transitOperatorUpsertBodySchema,
  transitRouteUpsertBodySchema,
  transitStationUpsertBodySchema,
  transitVehicleGpsBodySchema,
  transitVehicleUpsertBodySchema,
  type TransitAlertLevel,
  type TransitAlertState,
  type TransitDashboardStats,
  type TransitIncident,
  type TransitOperator,
  type TransitReport,
  type TransitRoute,
  type TransitStation,
  type TransitVehicle,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { broadcastToAgency } from "../lib/websocket/send-message.js";
import { ddb } from "../repositories/baseRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { TRANSIT_CONFIG_SK, TRANSIT_TABLE_ENV, transitTableEnv } from "./tables.js";

const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function isOperatorRole(role: string): boolean {
  const token = role.trim().toLowerCase();
  return token === "transit_operator" || token === "transit-operator";
}

async function queryAgency<T>(table: string, agencyId: string): Promise<T[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "agencyId = :a",
      ExpressionAttributeValues: { ":a": agencyId },
    }),
  );
  return (out.Items ?? []) as T[];
}

async function getItem<T>(
  table: string,
  key: Record<string, string>,
): Promise<T | null> {
  const out = await ddb.send(new GetCommand({ TableName: table, Key: key }));
  return (out.Item as T | undefined) ?? null;
}

async function operatorForUser(
  agencyId: string,
  user: UserContext,
): Promise<TransitOperator | null> {
  const operators = await queryAgency<TransitOperator>(
    transitTableEnv(TRANSIT_TABLE_ENV.operators),
    agencyId,
  );
  return (
    operators.find((row) => {
      const linked = (row.userId ?? "").trim();
      if (!linked) return false;
      if (linked === user.userId) return true;
      const email = (user.email ?? "").trim().toLowerCase();
      return Boolean(email) && linked.toLowerCase() === email;
    }) ?? null
  );
}

export async function listVehicles(agencyId: string, user: UserContext): Promise<TransitVehicle[]> {
  const items = await queryAgency<TransitVehicle>(
    transitTableEnv(TRANSIT_TABLE_ENV.vehicles),
    agencyId,
  );
  if (!isOperatorRole(user.role)) return items;
  const mine = await operatorForUser(agencyId, user);
  if (!mine?.vehicleId) return [];
  return items.filter((row) => row.vehicleId === mine.vehicleId);
}

export async function getVehicle(
  agencyId: string,
  vehicleId: string,
  user: UserContext,
): Promise<TransitVehicle | null> {
  const item = await getItem<TransitVehicle>(transitTableEnv(TRANSIT_TABLE_ENV.vehicles), {
    agencyId,
    vehicleId,
  });
  if (!item) return null;
  if (!isOperatorRole(user.role)) return item;
  const mine = await operatorForUser(agencyId, user);
  if (!mine?.vehicleId || mine.vehicleId !== vehicleId) return null;
  return item;
}

export async function upsertVehicle(
  agencyId: string,
  bodyUnknown: unknown,
  actorId: string,
): Promise<TransitVehicle> {
  const body = transitVehicleUpsertBodySchema.parse(bodyUnknown);
  const updatedAt = nowIso();
  const item: TransitVehicle = {
    ...body,
    agencyId,
    updatedAt: body.updatedAt ?? updatedAt,
  };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.vehicles), Item: item }),
  );
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.TRANSIT_VEHICLE_UPDATED,
    details: { vehicleId: item.vehicleId },
    createdAt: updatedAt,
    resourceType: "agency",
    resourceId: item.vehicleId,
  });
  return item;
}

export async function ingestVehicleGps(
  agencyId: string,
  vehicleId: string,
  bodyUnknown: unknown,
  user: UserContext,
): Promise<TransitVehicle> {
  const body = transitVehicleGpsBodySchema.parse(bodyUnknown);
  const gpsAt = body.gpsAt ?? nowIso();
  const updatedAt = nowIso();
  if (env.transitGpsMock) {
    return {
      agencyId,
      vehicleId,
      label: vehicleId,
      mode: "bus",
      status: "in_service",
      lastLat: body.lat,
      lastLng: body.lng,
      heading: body.heading,
      speedKph: body.speedKph,
      gpsAt,
      updatedAt,
    };
  }
  const existing = await getVehicle(agencyId, vehicleId, user);
  if (!existing) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: transitTableEnv(TRANSIT_TABLE_ENV.vehicles),
      Key: { agencyId, vehicleId },
      UpdateExpression:
        "SET lastLat = :lat, lastLng = :lng, heading = :h, speedKph = :s, gpsAt = :g, updatedAt = :u",
      ExpressionAttributeValues: {
        ":lat": body.lat,
        ":lng": body.lng,
        ":h": body.heading ?? existing.heading ?? 0,
        ":s": body.speedKph ?? existing.speedKph ?? 0,
        ":g": gpsAt,
        ":u": updatedAt,
      },
    }),
  );
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.TRANSIT_GPS_INGESTED,
    details: { vehicleId },
    createdAt: updatedAt,
    resourceType: "agency",
    resourceId: vehicleId,
  });
  return {
    ...existing,
    lastLat: body.lat,
    lastLng: body.lng,
    heading: body.heading ?? existing.heading,
    speedKph: body.speedKph ?? existing.speedKph,
    gpsAt,
    updatedAt,
  };
}

export async function listRoutes(agencyId: string): Promise<TransitRoute[]> {
  return queryAgency<TransitRoute>(transitTableEnv(TRANSIT_TABLE_ENV.routes), agencyId);
}

export async function upsertRoute(agencyId: string, bodyUnknown: unknown): Promise<TransitRoute> {
  const body = transitRouteUpsertBodySchema.parse(bodyUnknown);
  const item: TransitRoute = { ...body, agencyId, updatedAt: body.updatedAt ?? nowIso() };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.routes), Item: item }),
  );
  return item;
}

export async function listStations(agencyId: string): Promise<TransitStation[]> {
  return queryAgency<TransitStation>(transitTableEnv(TRANSIT_TABLE_ENV.stations), agencyId);
}

export async function upsertStation(
  agencyId: string,
  bodyUnknown: unknown,
): Promise<TransitStation> {
  const body = transitStationUpsertBodySchema.parse(bodyUnknown);
  const item: TransitStation = { ...body, agencyId, updatedAt: body.updatedAt ?? nowIso() };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.stations), Item: item }),
  );
  return item;
}

export async function listOperators(agencyId: string): Promise<TransitOperator[]> {
  return queryAgency<TransitOperator>(transitTableEnv(TRANSIT_TABLE_ENV.operators), agencyId);
}

export async function upsertOperator(
  agencyId: string,
  bodyUnknown: unknown,
): Promise<TransitOperator> {
  const body = transitOperatorUpsertBodySchema.parse(bodyUnknown);
  const item: TransitOperator = { ...body, agencyId, updatedAt: body.updatedAt ?? nowIso() };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.operators), Item: item }),
  );
  return item;
}

export async function listIncidents(agencyId: string): Promise<TransitIncident[]> {
  const items = await queryAgency<TransitIncident>(
    transitTableEnv(TRANSIT_TABLE_ENV.incidents),
    agencyId,
  );
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createIncident(
  agencyId: string,
  bodyUnknown: unknown,
  user: UserContext,
): Promise<TransitIncident> {
  const body = transitIncidentCreateBodySchema.parse(bodyUnknown);
  const createdAt = nowIso();
  const item: TransitIncident = {
    agencyId,
    incidentId: makeId("tinc"),
    type: body.type,
    status: "open",
    summary: body.summary,
    vehicleId: body.vehicleId,
    stationId: body.stationId,
    routeId: body.routeId,
    lat: body.lat,
    lng: body.lng,
    escalatedTo911: false,
    createdByUserId: user.userId,
    createdAt,
    updatedAt: createdAt,
  };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.incidents), Item: item }),
  );
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.TRANSIT_INCIDENT_CREATED,
    details: { incidentId: item.incidentId, type: item.type },
    createdAt,
    resourceType: "incident",
    resourceId: item.incidentId,
  });
  await broadcastToAgency({
    agencyId,
    message: { type: "transit.incident.created", data: { incidentId: item.incidentId } },
  });
  return item;
}

export async function patchIncident(
  agencyId: string,
  incidentId: string,
  bodyUnknown: unknown,
  user: UserContext,
): Promise<TransitIncident> {
  const body = transitIncidentPatchBodySchema.parse(bodyUnknown);
  const existing = await getItem<TransitIncident>(transitTableEnv(TRANSIT_TABLE_ENV.incidents), {
    agencyId,
    incidentId,
  });
  if (!existing) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const updatedAt = nowIso();
  const next: TransitIncident = {
    ...existing,
    ...body,
    updatedAt,
  };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.incidents), Item: next }),
  );
  const escalated = body.escalatedTo911 === true && existing.escalatedTo911 !== true;
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: escalated
      ? AUDIT_EVENT_TYPES.TRANSIT_INCIDENT_ESCALATED
      : AUDIT_EVENT_TYPES.TRANSIT_INCIDENT_UPDATED,
    details: { incidentId, ...body },
    createdAt: updatedAt,
    resourceType: "incident",
    resourceId: incidentId,
  });
  return next;
}

export async function listReports(agencyId: string): Promise<TransitReport[]> {
  const items = await queryAgency<TransitReport>(
    transitTableEnv(TRANSIT_TABLE_ENV.reports),
    agencyId,
  );
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function sendBroadcast(
  agencyId: string,
  bodyUnknown: unknown,
  user: UserContext,
): Promise<{ reportId: string }> {
  const body = transitBroadcastBodySchema.parse(bodyUnknown);
  const createdAt = nowIso();
  const reportId = makeId("tbcast");
  const item: TransitReport = {
    agencyId,
    reportId,
    source: "ops",
    summary: body.message,
    vehicleId: body.vehicleId,
    createdAt,
  };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.reports), Item: item }),
  );
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.TRANSIT_BROADCAST_SENT,
    details: { reportId, audience: body.audience },
    createdAt,
    resourceType: "agency",
    resourceId: reportId,
  });
  await broadcastToAgency({
    agencyId,
    message: { type: "transit.broadcast", data: { reportId, message: body.message } },
  });
  return { reportId };
}

export async function getAlertLevel(agencyId: string): Promise<TransitAlertState> {
  const item = await getItem<TransitAlertState & { sk?: string }>(
    transitTableEnv(TRANSIT_TABLE_ENV.config),
    { agencyId, sk: TRANSIT_CONFIG_SK },
  );
  if (item?.level) {
    return {
      agencyId,
      level: item.level,
      updatedAt: item.updatedAt,
      updatedByUserId: item.updatedByUserId,
    };
  }
  return { agencyId, level: "nominal", updatedAt: nowIso() };
}

export async function setAlertLevel(
  agencyId: string,
  bodyUnknown: unknown,
  user: UserContext,
): Promise<TransitAlertState> {
  const body = transitAlertLevelPatchSchema.parse(bodyUnknown);
  const updatedAt = nowIso();
  const item: TransitAlertState & { sk: string } = {
    agencyId,
    sk: TRANSIT_CONFIG_SK,
    level: body.level,
    updatedAt,
    updatedByUserId: user.userId,
  };
  await ddb.send(
    new PutCommand({ TableName: transitTableEnv(TRANSIT_TABLE_ENV.config), Item: item }),
  );
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.TRANSIT_ALERT_CHANGED,
    details: { level: body.level },
    createdAt: updatedAt,
    resourceType: "agency",
    resourceId: agencyId,
  });
  await broadcastToAgency({
    agencyId,
    message: { type: "transit.alert", data: { level: body.level } },
  });
  return { agencyId, level: body.level, updatedAt, updatedByUserId: user.userId };
}

export async function getDashboard(
  agencyId: string,
  user: UserContext,
): Promise<{
  stats: TransitDashboardStats;
  vehicles: TransitVehicle[];
  incidents: TransitIncident[];
  operators: TransitOperator[];
  routes: TransitRoute[];
  stations: TransitStation[];
  reports: TransitReport[];
  alert: TransitAlertState;
}> {
  const [vehicles, incidents, allOperators, routes, stations, reports, alert] = await Promise.all([
    listVehicles(agencyId, user),
    listIncidents(agencyId),
    listOperators(agencyId),
    listRoutes(agencyId),
    listStations(agencyId),
    listReports(agencyId),
    getAlertLevel(agencyId),
  ]);
  const operators = isOperatorRole(user.role)
    ? allOperators.filter((row) => {
        const linked = (row.userId ?? "").trim();
        if (!linked) return false;
        if (linked === user.userId) return true;
        const email = (user.email ?? "").trim().toLowerCase();
        return Boolean(email) && linked.toLowerCase() === email;
      })
    : allOperators;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const dayIso = startOfDay.toISOString();
  const open = new Set(["open", "assigned", "responding"]);
  const stats: TransitDashboardStats = {
    vehiclesInService: vehicles.filter((v) => v.status === "in_service").length,
    vehiclesDelayed: vehicles.filter((v) => v.status === "delayed").length,
    vehiclesIncident: vehicles.filter((v) => v.status === "incident").length,
    activeIncidents: incidents.filter((i) => open.has(i.status)).length,
    operatorsOnDuty: operators.filter((o) => o.onDuty).length,
    passengerReportsToday: reports.filter((r) => r.source !== "ops" && r.createdAt >= dayIso)
      .length,
    alertLevel: alert.level,
  };
  return { stats, vehicles, incidents, operators, routes, stations, reports, alert };
}

export function defaultAlertLevel(): TransitAlertLevel {
  return "nominal";
}
