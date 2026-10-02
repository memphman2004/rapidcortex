import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  venueNotificationBodySchema,
  type VenueEventsResponse,
  type VenueOnDutyStaff,
  type VenueSectionSummary,
  type VenueStatsResponse,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { VENUE_KEYS } from "../../venue/venue-types.js";
import { listVenueSections } from "../../venue/venue-section-service.js";
import { venueCodeFromAgencyId, initialsFromName } from "../vertical/agency-id.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

const OPEN_STATUSES = new Set(["open", "assigned", "responding", "processing"]);

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

function venueNotificationLogTable(): string {
  const t = process.env.VENUE_NOTIFICATION_LOG_TABLE?.trim();
  if (!t) throw new Error("VENUE_NOTIFICATION_LOG_TABLE not set");
  return t;
}

async function listOpenVenueIncidents(venueCode: string): Promise<Array<{ sectionId?: string; section?: string }>> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(venueCode),
        ":prefix": "INCIDENT#",
      },
      Limit: 200,
    }),
  );
  return (result.Items ?? []).filter((row) => OPEN_STATUSES.has(String(row.status ?? "")));
}

async function listVenueOnDutyStaff(venueCode: string): Promise<VenueOnDutyStaff[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.configPk(venueCode),
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
        zone: String(row.zone ?? "VENUE"),
        status: (row.dutyStatus ?? "available") as VenueOnDutyStaff["status"],
      };
    });
}

async function countGuestReportsToday(agencyId: string): Promise<number> {
  const table = process.env.VENUE_NOTIFICATION_LOG_TABLE?.trim();
  if (!table) return 0;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "agencyId = :aid",
        FilterExpression: "begins_with(createdAt, :day) AND audience = :guest",
        ExpressionAttributeValues: { ":aid": agencyId, ":day": today, ":guest": "guest_report" },
        Select: "COUNT",
      }),
    );
    return result.Count ?? 0;
  } catch (error) {
    // KPI only — missing/mis-keyed log table must not 500 the venue dashboard.
    console.warn("[venue-stats] guest report count skipped", error);
    return 0;
  }
}

export async function getVenueStats(agencyId: string): Promise<VenueStatsResponse> {
  const venueCode = venueCodeFromAgencyId(agencyId);
  const [incidents, sections, staff, guestReportsToday] = await Promise.all([
    listOpenVenueIncidents(venueCode),
    listVenueSections(venueCode, agencyId),
    listVenueOnDutyStaff(venueCode),
    countGuestReportsToday(agencyId),
  ]);

  return {
    activeIncidents: incidents.length,
    securityOnDuty: staff.length,
    sectionsMonitored: sections.length,
    guestReportsToday,
  };
}

export async function getVenueSectionsSummary(agencyId: string): Promise<VenueSectionSummary[]> {
  const venueCode = venueCodeFromAgencyId(agencyId);
  const [sections, incidents] = await Promise.all([
    listVenueSections(venueCode, agencyId),
    listOpenVenueIncidents(venueCode),
  ]);

  const bySection = new Map<string, number>();
  for (const inc of incidents) {
    const key = String(inc.sectionId ?? inc.section ?? "UNKNOWN");
    bySection.set(key, (bySection.get(key) ?? 0) + 1);
  }

  return sections.map((s) => ({
    sectionId: s.id,
    sectionName: s.label,
    gate: s.zone ?? "Main",
    level: s.level,
    capacity: s.capacity ?? 0,
    incidentCount: bySection.get(s.id) ?? 0,
    status: s.status,
  }));
}

export async function getVenueEvents(agencyId: string): Promise<VenueEventsResponse> {
  const venueCode = venueCodeFromAgencyId(agencyId);
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: { pk: VENUE_KEYS.configPk(venueCode), sk: "EVENTS" },
    }),
  );
  const row = result.Item as VenueEventsResponse | undefined;
  return (
    row ?? {
      currentEvent: null,
      upcomingEvents: [],
    }
  );
}

export async function getVenueOnDuty(agencyId: string): Promise<VenueOnDutyStaff[]> {
  return listVenueOnDutyStaff(venueCodeFromAgencyId(agencyId));
}

export async function postVenueNotification(opts: {
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<{ notificationId: string }> {
  const parsed = venueNotificationBodySchema.parse(opts.body);
  const now = new Date().toISOString();
  const notificationId = makeId("notify");

  await ddb.send(
    new PutCommand({
      TableName: venueNotificationLogTable(),
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
    type: AUDIT_EVENT_TYPES.VENUE_NOTIFICATION_SENT,
    details: { notificationId, audience: parsed.audience, priority: parsed.priority },
    createdAt: now,
    resourceType: "agency",
    resourceId: notificationId,
  });

  await broadcastToAgency({
    agencyId: opts.agencyId,
    message: {
      type: "venue:notification-sent",
      data: { notificationId, priority: parsed.priority },
    },
  });

  return { notificationId };
}
