import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  campusBroadcastBodySchema,
  campusNotificationBodySchema,
  campusThreatLevelPatchSchema,
  type CampusBuildingSummary,
  type CampusOnDutyStaff,
  type CampusStatsResponse,
  type CampusThreatLevelState,
  type CampusZoneSummary,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { CAMPUS_KEYS, type CampusIncident } from "../../campus/campus-types.js";
import { getCampusBuildings } from "../../campus/campus-config-service.js";
import { getResolvedCampusSites } from "../../campus/campus-sites-service.js";
import { campusCodeFromAgencyId, initialsFromName } from "../vertical/agency-id.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

const THREAT_SK = "THREAT_LEVEL";
const OPEN_STATUSES = new Set(["open", "assigned", "responding"]);

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

function campusIncidentsTable(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

function campusNotificationLogTable(): string {
  const t = process.env.CAMPUS_NOTIFICATION_LOG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_NOTIFICATION_LOG_TABLE not set");
  return t;
}

async function listOpenIncidents(campusCode: string): Promise<CampusIncident[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: campusIncidentsTable(),
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": CAMPUS_KEYS.incidentPk(campusCode) },
      ScanIndexForward: false,
      Limit: 200,
    }),
  );
  return ((result.Items ?? []) as CampusIncident[]).filter(
    (row) => row.sk?.startsWith("INCIDENT#") && OPEN_STATUSES.has(row.status),
  );
}

async function countAlertsToday(agencyId: string): Promise<number> {
  const table = process.env.CAMPUS_NOTIFICATION_LOG_TABLE?.trim();
  if (!table) return 0;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "agencyId = :aid",
        FilterExpression: "begins_with(createdAt, :day)",
        ExpressionAttributeValues: { ":aid": agencyId, ":day": today },
        Select: "COUNT",
      }),
    );
    return result.Count ?? 0;
  } catch (error) {
    // KPI only — missing/mis-keyed log table must not 500 the campus dashboard.
    console.warn("[campus-stats] alert count skipped", error);
    return 0;
  }
}

async function listOnDutyStaff(campusCode: string, _agencyId: string): Promise<CampusOnDutyStaff[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: campusConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": CAMPUS_KEYS.configPk(campusCode),
        ":prefix": "STAFF#",
      },
    }),
  );

  return (result.Items ?? [])
    .filter((row) => row.active !== false && row.onDuty !== false)
    .map((row) => {
      const name = String(row.name ?? "Staff");
      return {
        userId: String(row.userId ?? String(row.sk ?? "").replace("STAFF#", "")),
        displayName: name,
        initials: initialsFromName(name),
        role: String(row.role ?? "Security"),
        zone: String(row.zone ?? "CAMPUS"),
        status: (row.dutyStatus ?? "available") as CampusOnDutyStaff["status"],
      };
    });
}

function zoneStatus(incidentCount: number): CampusZoneSummary["status"] {
  if (incidentCount >= 2) return "elevated";
  if (incidentCount >= 1) return "active";
  return "clear";
}

function buildingStatus(activeIncidents: number, closed?: boolean): CampusBuildingSummary["status"] {
  if (closed) return "closed";
  if (activeIncidents > 0) return "alert";
  return "nominal";
}

export async function getCampusStats(agencyId: string): Promise<CampusStatsResponse> {
  const campusCode = campusCodeFromAgencyId(agencyId);
  const [incidents, buildings, staff, alertsSentToday, sitesResolved] = await Promise.all([
    listOpenIncidents(campusCode),
    getCampusBuildings(campusCode),
    listOnDutyStaff(campusCode, agencyId),
    countAlertsToday(agencyId),
    getResolvedCampusSites(campusCode, agencyId),
  ]);

  return {
    activeIncidents: incidents.length,
    respondersOnDuty: staff.length,
    buildingsMonitored: buildings.length,
    alertsSentToday,
    sites: sitesResolved.sites,
    primarySiteCode: sitesResolved.primarySiteCode,
  };
}

export async function getCampusZonesSummary(agencyId: string): Promise<CampusZoneSummary[]> {
  const campusCode = campusCodeFromAgencyId(agencyId);
  const [buildings, incidents, staff] = await Promise.all([
    getCampusBuildings(campusCode),
    listOpenIncidents(campusCode),
    listOnDutyStaff(campusCode, agencyId),
  ]);

  const zoneMap = new Map<string, CampusZoneSummary>();

  for (const building of buildings) {
    for (const zone of building.zones ?? []) {
      const zoneId = zone.code;
      if (!zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, {
          zoneId,
          zoneName: zone.label,
          incidentCount: 0,
          responderCount: 0,
          status: "clear",
          siteCode: building.siteCode,
        });
      }
    }
  }

  for (const inc of incidents) {
    const key = inc.zoneCode ?? inc.roomCode ?? "UNKNOWN";
    const entry = zoneMap.get(key) ?? {
      zoneId: key,
      zoneName: inc.zoneLabel || key,
      incidentCount: 0,
      responderCount: 0,
      status: "clear" as const,
      siteCode: inc.siteCode,
    };
    entry.incidentCount += 1;
    zoneMap.set(key, entry);
  }

  for (const member of staff) {
    const entry = zoneMap.get(member.zone);
    if (entry) entry.responderCount += 1;
  }

  return Array.from(zoneMap.values()).map((z) => ({
    ...z,
    status: zoneStatus(z.incidentCount),
  }));
}

export async function getCampusBuildingsSummary(agencyId: string): Promise<CampusBuildingSummary[]> {
  const campusCode = campusCodeFromAgencyId(agencyId);
  const [buildings, incidents] = await Promise.all([
    getCampusBuildings(campusCode),
    listOpenIncidents(campusCode),
  ]);

  const byBuilding = new Map<string, number>();
  for (const inc of incidents) {
    const key = inc.buildingCode ?? inc.buildingLabel;
    byBuilding.set(key, (byBuilding.get(key) ?? 0) + 1);
  }

  return buildings.map((b) => {
    const activeIncidents = byBuilding.get(b.code) ?? byBuilding.get(b.label) ?? b.activeIncidents ?? 0;
    const primaryZone = b.zones?.[0]?.label ?? b.zones?.[0]?.code ?? "CAMPUS";
    return {
      buildingId: b.code,
      buildingName: b.label,
      zone: primaryZone,
      occupancy: b.capacity ?? null,
      status: buildingStatus(activeIncidents, false),
      activeIncidents,
      siteCode: b.siteCode,
    };
  });
}

export async function getCampusThreatLevel(agencyId: string): Promise<CampusThreatLevelState> {
  const campusCode = campusCodeFromAgencyId(agencyId);
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: { pk: CAMPUS_KEYS.configPk(campusCode), sk: THREAT_SK },
    }),
  );
  const row = result.Item as CampusThreatLevelState | undefined;
  return (
    row ?? {
      level: "secure",
      setAt: new Date(0).toISOString(),
      setBy: "system",
    }
  );
}

export async function patchCampusThreatLevel(opts: {
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<CampusThreatLevelState> {
  const campusCode = campusCodeFromAgencyId(opts.agencyId);
  const parsed = campusThreatLevelPatchSchema.parse(opts.body);
  const now = new Date().toISOString();

  const item: CampusThreatLevelState & { agencyId: string; pk: string; sk: string } = {
    pk: CAMPUS_KEYS.configPk(campusCode),
    sk: THREAT_SK,
    agencyId: opts.agencyId,
    level: parsed.level,
    setAt: now,
    setBy: opts.actorId,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: item,
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_THREAT_LEVEL_CHANGED,
    details: { level: parsed.level, campusCode },
    createdAt: now,
    resourceType: "agency",
    resourceId: campusCode,
  });

  await broadcastToAgency({
    agencyId: opts.agencyId,
    message: {
      type: "campus:threat-level-changed",
      data: { level: parsed.level, setAt: now, setBy: opts.actorId },
    },
  });

  return { level: parsed.level, setAt: now, setBy: opts.actorId };
}

export async function getCampusOnDuty(agencyId: string): Promise<CampusOnDutyStaff[]> {
  return listOnDutyStaff(campusCodeFromAgencyId(agencyId), agencyId);
}

export async function postCampusNotification(opts: {
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<{ notificationId: string }> {
  const parsed = campusNotificationBodySchema.parse(opts.body);
  const now = new Date().toISOString();
  const notificationId = makeId("notify");

  await ddb.send(
    new PutCommand({
      TableName: campusNotificationLogTable(),
      Item: {
        agencyId: opts.agencyId,
        notificationId,
        ...parsed,
        actorId: opts.actorId,
        createdAt: now,
        ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
      },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_NOTIFICATION_SENT,
    details: { notificationId, audience: parsed.audience, priority: parsed.priority },
    createdAt: now,
    resourceType: "agency",
    resourceId: notificationId,
  });

  await broadcastToAgency({
    agencyId: opts.agencyId,
    message: {
      type: "campus:notification-sent",
      data: { notificationId, priority: parsed.priority, audience: parsed.audience },
    },
  });

  return { notificationId };
}

export async function postCampusBroadcast(opts: {
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<{ broadcastId: string; cooldownSeconds?: number }> {
  const parsed = campusBroadcastBodySchema.parse(opts.body);
  const now = new Date().toISOString();
  const hourKey = now.slice(0, 13);
  const campusCode = campusCodeFromAgencyId(opts.agencyId);

  const rateRow = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: { pk: CAMPUS_KEYS.configPk(campusCode), sk: `BROADCAST_RATE#${hourKey}` },
    }),
  );
  const count = Number(rateRow.Item?.count ?? 0);
  if (count >= 3) {
    const err = new Error("RATE_LIMIT");
    (err as Error & { cooldownSeconds: number }).cooldownSeconds = 3600;
    throw err;
  }

  const broadcastId = makeId("broadcast");

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: `BROADCAST_RATE#${hourKey}`,
        agencyId: opts.agencyId,
        count: count + 1,
        updatedAt: now,
      },
    }),
  );

  await ddb.send(
    new PutCommand({
      TableName: campusNotificationLogTable(),
      Item: {
        agencyId: opts.agencyId,
        notificationId: broadcastId,
        kind: "emergency_broadcast",
        message: parsed.message,
        channels: parsed.channels,
        actorId: opts.actorId,
        createdAt: now,
        ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
      },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_EMERGENCY_BROADCAST,
    details: { broadcastId, channels: parsed.channels },
    createdAt: now,
    resourceType: "agency",
    resourceId: broadcastId,
  });

  return { broadcastId };
}
