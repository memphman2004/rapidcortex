import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import type { VenueIncidentRecord, VenueIncidentSource, VenueIncidentType } from "./venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

function mapHelpType(helpType: string): VenueIncidentType {
  const map: Record<string, VenueIncidentType> = {
    medical: "medical",
    safety: "security",
    security: "security",
    suspicious: "security",
    lost_person: "lost_person",
    maintenance: "maintenance",
    guest_services: "guest_services",
    other: "other",
  };
  return map[helpType] ?? "other";
}

export type CreateVenueQrIncidentInput = {
  venueCode: string;
  agencyId: string;
  rcli: string;
  locationName: string;
  zoneCode: string;
  building?: string;
  floor?: string;
  helpType: string;
  description: string;
  isAnonymous: boolean;
  reporterName?: string | null;
  reporterPhone?: string | null;
  lat?: number | null;
  lng?: number | null;
  mediaKeys?: string[];
};

export async function createVenueQrIncident(input: CreateVenueQrIncidentInput): Promise<VenueIncidentRecord> {
  const venueCode = input.venueCode.toUpperCase();
  const year = new Date().getFullYear();
  const incidentId = `${venueCode}-${year}-${String(Date.now()).slice(-6)}`;
  const now = new Date().toISOString();
  const type = mapHelpType(input.helpType);

  const item: VenueIncidentRecord = {
    pk: `VENUE#${venueCode}`,
    sk: `INCIDENT#${incidentId}`,
    incidentId,
    venueCode,
    zoneCode: input.zoneCode,
    zoneLabel: input.locationName,
    qrRcli: input.rcli,
    qrLocationName: input.locationName,
    type,
    source: "qr" as VenueIncidentSource,
    status: "open",
    description: input.description,
    callerPhone: input.reporterPhone ?? "",
    hasMedia: (input.mediaKeys?.length ?? 0) > 0,
    mediaUrls: input.mediaKeys ?? [],
    cameraRefs: [],
    assignedTo: null,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        ...item,
        agencyId: input.agencyId,
        building: input.building ?? null,
        floor: input.floor ?? null,
        isAnonymous: input.isAnonymous,
        reporterName: input.isAnonymous ? null : input.reporterName ?? null,
        gpsLat: input.lat ?? null,
        gpsLng: input.lng ?? null,
        origin: "qr_scan",
      },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: input.agencyId,
    incidentId,
    actorId: "qr-intake",
    type: AUDIT_EVENT_TYPES.INCIDENT_CREATED,
    details: {
      venueCode,
      rcli: input.rcli,
      zoneCode: input.zoneCode,
      type,
    },
    createdAt: now,
    resourceType: "incident",
    resourceId: incidentId,
  });

  return item;
}

export type VenueIncidentListItem = {
  id: string;
  venueCode: string;
  zoneCode: string;
  zoneLabel: string;
  qrRcli?: string;
  qrLocationName?: string;
  type: VenueIncidentType;
  source: VenueIncidentSource;
  status: VenueIncidentRecord["status"];
  description: string;
  confidence: "high" | "medium" | "low";
  assignedTo: string | null;
  cameraRefs: string[];
  hasMedia: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

function incidentConfidence(source: VenueIncidentSource): "high" | "medium" | "low" {
  if (source === "qr") return "high";
  if (source === "sms") return "medium";
  return "low";
}

function toListItem(record: VenueIncidentRecord): VenueIncidentListItem {
  return {
    id: record.incidentId,
    venueCode: record.venueCode,
    zoneCode: record.zoneCode,
    zoneLabel: record.zoneLabel,
    qrRcli: record.qrRcli,
    qrLocationName: record.qrLocationName,
    type: record.type,
    source: record.source,
    status: record.status,
    description: record.description,
    confidence: incidentConfidence(record.source),
    assignedTo: record.assignedTo,
    cameraRefs: record.cameraRefs,
    hasMedia: record.hasMedia,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.status === "resolved" ? record.updatedAt : null,
  };
}

export async function listVenueIncidents(opts: {
  venueCode: string;
  agencyId: string;
  status?: VenueIncidentRecord["status"][];
  type?: VenueIncidentType[];
  limit?: number;
  cursor?: string;
}): Promise<{ incidents: VenueIncidentListItem[]; cursor?: string; total: number }> {
  const limit = opts.limit ?? 25;
  const venueCode = opts.venueCode.toUpperCase();
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `VENUE#${venueCode}`,
        ":sk": "INCIDENT#",
        ":agencyId": opts.agencyId,
      },
      FilterExpression: "agencyId = :agencyId",
      Limit: limit + 1,
      ExclusiveStartKey: opts.cursor
        ? JSON.parse(Buffer.from(opts.cursor, "base64").toString())
        : undefined,
      ScanIndexForward: false,
    }),
  );

  let items = (result.Items ?? []) as VenueIncidentRecord[];

  if (opts.status?.length) {
    items = items.filter((row) => opts.status!.includes(row.status));
  }
  if (opts.type?.length) {
    items = items.filter((row) => opts.type!.includes(row.type));
  }

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

  return {
    incidents: page.map(toListItem),
    cursor: nextCursor,
    total: page.length,
  };
}
