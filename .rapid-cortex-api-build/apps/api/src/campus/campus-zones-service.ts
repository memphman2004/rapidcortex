import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  campusZoneCreateBodySchema,
  campusZoneUpdateBodySchema,
  normalizeCampusSiteCode,
  type CampusZoneCreateBody,
  type CampusZoneSummary,
  type CampusZoneUpdateBody,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { campusCodeFromAgencyId } from "../handlers/vertical/agency-id.js";
import { CAMPUS_KEYS, type CampusZone } from "./campus-types.js";
import { getCampusBuildings, getCampusConfig, getCampusZone } from "./campus-config-service.js";
import { getResolvedCampusSites } from "./campus-sites-service.js";
import { getCampusZonesSummary } from "../handlers/campus/campus-dashboard-service.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

function slugZone(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

type StoredZone = CampusZone & {
  pk?: string;
  sk?: string;
  siteCode?: string;
  agencyId?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

async function ensureBuilding(opts: {
  campusCode: string;
  agencyId: string;
  siteCode: string;
  buildingLabel: string;
}): Promise<void> {
  const pk = CAMPUS_KEYS.configPk(opts.campusCode);
  const sk = CAMPUS_KEYS.buildingSk(opts.siteCode);
  const existing = await ddb.send(
    new GetCommand({ TableName: campusConfigTable(), Key: { pk, sk } }),
  );
  if (existing.Item) return;
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk,
        sk,
        id: `b-${opts.siteCode.toLowerCase()}`,
        campusCode: opts.campusCode,
        agencyId: opts.agencyId,
        code: opts.siteCode,
        label: opts.buildingLabel,
        type: "academic",
        floors: 2,
        capacity: null,
        cameraIds: [],
        activeIncidents: 0,
        siteCode: opts.siteCode,
        zones: [],
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
}

export async function listCampusZonesForAgency(agencyId: string): Promise<CampusZoneSummary[]> {
  return getCampusZonesSummary(agencyId);
}

export async function createCampusZone(opts: {
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<CampusZoneSummary> {
  const parsed: CampusZoneCreateBody = campusZoneCreateBodySchema.parse(opts.body);
  const campusCode = campusCodeFromAgencyId(opts.agencyId);
  const siteCode = normalizeCampusSiteCode(parsed.siteCode);
  const { sites } = await getResolvedCampusSites(campusCode, opts.agencyId);
  const site = sites.find((s) => s.code === siteCode);
  if (!site) throw new Error("UNKNOWN_SITE");

  await ensureBuilding({
    campusCode,
    agencyId: opts.agencyId,
    siteCode,
    buildingLabel: site.name,
  });

  const floor = parsed.floor ?? 1;
  const baseSlug = slugZone(parsed.label) || "ZONE";
  let code = `${siteCode}-${floor}-${baseSlug}`;
  let existing = await getCampusZone(campusCode, code);
  if (existing) {
    code = `${siteCode}-${floor}-${baseSlug}-${makeId("z").slice(-6).toUpperCase()}`;
    existing = await getCampusZone(campusCode, code);
    if (existing) throw new Error("ZONE_EXISTS");
  }

  const now = new Date().toISOString();
  const config = await getCampusConfig(campusCode);
  const item: StoredZone = {
    code,
    label: parsed.label.trim(),
    buildingCode: siteCode,
    buildingLabel: site.name,
    floor,
    roomCode: baseSlug,
    cameraIds: [],
    qrUrl: `https://www.rapidcortex.us/report/campus/${campusCode}?zone=${encodeURIComponent(code)}`,
    siteCode,
    agencyId: opts.agencyId,
    sortOrder: Date.now() % 100000,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.zoneSk(code),
        campusCode,
        campusName: config?.campusName,
        ...item,
      },
      ConditionExpression: "attribute_not_exists(sk)",
    }),
  );

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CAMPUS_ZONE_CREATED,
      details: { campusCode, zoneId: code, label: item.label, siteCode },
      createdAt: now,
      resourceType: "campus_zone",
      resourceId: code,
    });
  } catch (err) {
    console.warn("[campus-zones] audit create skipped", err);
  }

  return {
    zoneId: code,
    zoneName: item.label,
    incidentCount: 0,
    responderCount: 0,
    status: "clear",
    siteCode,
  };
}

export async function updateCampusZone(opts: {
  agencyId: string;
  actorId: string;
  zoneId: string;
  body: unknown;
}): Promise<CampusZoneSummary> {
  const parsed: CampusZoneUpdateBody = campusZoneUpdateBodySchema.parse(opts.body);
  const campusCode = campusCodeFromAgencyId(opts.agencyId);
  const zoneId = opts.zoneId.trim();
  if (!zoneId) throw new Error("NOT_FOUND");

  const existing = await getCampusZone(campusCode, zoneId);
  if (!existing) throw new Error("NOT_FOUND");

  const stored = existing as StoredZone;
  if (stored.agencyId && stored.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const now = new Date().toISOString();
  const label = parsed.label.trim();
  const next: StoredZone = {
    ...stored,
    label,
    roomCode: slugZone(label) || stored.roomCode,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.zoneSk(zoneId),
        campusCode,
        ...next,
        code: zoneId,
      },
    }),
  );

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CAMPUS_ZONE_UPDATED,
      details: { campusCode, zoneId, label },
      createdAt: now,
      resourceType: "campus_zone",
      resourceId: zoneId,
    });
  } catch (err) {
    console.warn("[campus-zones] audit update skipped", err);
  }

  const summaries = await getCampusZonesSummary(opts.agencyId);
  const match = summaries.find((z) => z.zoneId === zoneId);
  return (
    match ?? {
      zoneId,
      zoneName: label,
      incidentCount: 0,
      responderCount: 0,
      status: "clear",
      siteCode: stored.siteCode ?? stored.buildingCode,
    }
  );
}

export async function deleteCampusZone(opts: {
  agencyId: string;
  actorId: string;
  zoneId: string;
}): Promise<{ deleted: true; zoneId: string }> {
  const campusCode = campusCodeFromAgencyId(opts.agencyId);
  const zoneId = opts.zoneId.trim();
  if (!zoneId) throw new Error("NOT_FOUND");

  const existing = await getCampusZone(campusCode, zoneId);
  if (!existing) throw new Error("NOT_FOUND");
  const stored = existing as StoredZone;
  if (stored.agencyId && stored.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  await ddb.send(
    new DeleteCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.zoneSk(zoneId),
      },
    }),
  );

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CAMPUS_ZONE_DELETED,
      details: { campusCode, zoneId, label: stored.label },
      createdAt: new Date().toISOString(),
      resourceType: "campus_zone",
      resourceId: zoneId,
    });
  } catch (err) {
    console.warn("[campus-zones] audit delete skipped", err);
  }

  return { deleted: true, zoneId };
}

/** Verify buildings exist for an agency (used by tests / diagnostics). */
export async function countCampusBuildings(agencyId: string): Promise<number> {
  const campusCode = campusCodeFromAgencyId(agencyId);
  const buildings = await getCampusBuildings(campusCode);
  return buildings.length;
}
