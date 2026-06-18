import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { getCamerasForSection } from "../handlers/venue/venue-camera-registry-service.js";
import { broadcastVenueIncidentCreated } from "./venue-incident-realtime.js";
import type { VenueIncidentRecord, VenueIncidentSource, VenueIncidentType } from "./venue-types.js";
import type { ParsedVenueSms } from "./venue-sms-parser.js";
import { venueCodeFromAgencyId } from "../handlers/vertical/agency-id.js";

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

export type CreateVenueQrIncidentResult = {
  incident: VenueIncidentRecord;
  cameras: VenueIncidentCameraSummary[];
};

type CreateVenueIntakeIncidentInput = {
  venueCode: string;
  agencyId: string;
  zoneCode: string;
  locationName: string;
  helpType: string;
  description: string;
  source: VenueIncidentSource;
  origin: string;
  actorId: string;
  isAnonymous: boolean;
  reporterName?: string | null;
  reporterPhone?: string | null;
  rcli?: string;
  building?: string;
  floor?: string;
  lat?: number | null;
  lng?: number | null;
  mediaKeys?: string[];
};

/** Normalize SMS zone hints like "Section 124" → "124" for camera registry lookup. */
export function sectionFromZoneHint(zoneHint: string): string {
  const trimmed = zoneHint.trim();
  if (!trimmed) return "UNKNOWN";
  const section = trimmed.match(/(?:section|sec|sect)\s*(\d{1,4}[a-z]?)/i);
  if (section?.[1]) return section[1];
  const gate = trimmed.match(/(?:gate|entrance)\s*([a-z])/i);
  if (gate?.[1]) return gate[1].toUpperCase();
  const level = trimmed.match(/(?:concourse|level)\s*(\d+)/i);
  if (level?.[1]) return level[1];
  return trimmed;
}

async function createVenueIntakeIncident(
  input: CreateVenueIntakeIncidentInput,
): Promise<CreateVenueQrIncidentResult> {
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
    source: input.source,
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
        origin: input.origin,
      },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: input.agencyId,
    incidentId,
    actorId: input.actorId,
    type: AUDIT_EVENT_TYPES.INCIDENT_CREATED,
    details: {
      venueCode,
      rcli: input.rcli,
      zoneCode: input.zoneCode,
      type,
      source: input.source,
    },
    createdAt: now,
    resourceType: "incident",
    resourceId: incidentId,
  });

  let cameras: VenueIncidentCameraSummary[] = [];
  try {
    cameras = await getCamerasForSection(input.agencyId, input.zoneCode, 2);
  } catch (err) {
    console.warn("[createVenueIntakeIncident] camera lookup failed", err);
  }

  await broadcastVenueIncidentCreated({
    agencyId: input.agencyId,
    incident: item,
    cameras,
  });

  return { incident: item, cameras };
}

export async function createVenueQrIncident(
  input: CreateVenueQrIncidentInput,
): Promise<CreateVenueQrIncidentResult> {
  return createVenueIntakeIncident({
    venueCode: input.venueCode,
    agencyId: input.agencyId,
    zoneCode: input.zoneCode,
    locationName: input.locationName,
    helpType: input.helpType,
    description: input.description,
    source: "qr",
    origin: "qr_scan",
    actorId: "qr-intake",
    isAnonymous: input.isAnonymous,
    reporterName: input.reporterName,
    reporterPhone: input.reporterPhone,
    rcli: input.rcli,
    building: input.building,
    floor: input.floor,
    lat: input.lat,
    lng: input.lng,
    mediaKeys: input.mediaKeys,
  });
}

export async function createVenueSmsIncident(input: {
  agencyId: string;
  parsed: ParsedVenueSms;
  callerPhone: string;
}): Promise<CreateVenueQrIncidentResult> {
  const venueCode = input.parsed.venueCode.toUpperCase();
  const zoneCode = sectionFromZoneHint(input.parsed.zoneHint);
  const locationName = input.parsed.zoneHint.trim() || `${venueCode} venue`;
  return createVenueIntakeIncident({
    venueCode,
    agencyId: input.agencyId,
    zoneCode,
    locationName,
    helpType: input.parsed.detectedType,
    description: input.parsed.cleanDescription,
    source: "sms",
    origin: "sms_inbound",
    actorId: "sms-inbound",
    isAnonymous: true,
    reporterPhone: input.callerPhone,
  });
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
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

function incidentConfidence(source: VenueIncidentSource): "high" | "medium" | "low" {
  if (source === "qr") return "high";
  if (source === "sms") return "medium";
  return "low";
}

function readGps(
  record: VenueIncidentRecord & { gpsLat?: number | null; gpsLng?: number | null },
): { latitude: number | null; longitude: number | null } {
  const lat = record.gpsLat;
  const lng = record.gpsLng;
  return {
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lng === "number" ? lng : null,
  };
}

function toListItem(
  record: VenueIncidentRecord & { gpsLat?: number | null; gpsLng?: number | null },
): VenueIncidentListItem {
  const gps = readGps(record);
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
    latitude: gps.latitude,
    longitude: gps.longitude,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.status === "resolved" ? record.updatedAt : null,
  };
}

export async function getVenueIncident(opts: {
  venueCode: string;
  agencyId: string;
  incidentId: string;
}): Promise<VenueIncidentListItem | null> {
  const venueCode = opts.venueCode.toUpperCase();
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: `VENUE#${venueCode}`,
        sk: `INCIDENT#${opts.incidentId}`,
      },
    }),
  );
  const item = result.Item as
    | (VenueIncidentRecord & { agencyId?: string; gpsLat?: number | null; gpsLng?: number | null })
    | undefined;
  if (!item) return null;
  if (item.agencyId && item.agencyId !== opts.agencyId) return null;
  return toListItem(item);
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
