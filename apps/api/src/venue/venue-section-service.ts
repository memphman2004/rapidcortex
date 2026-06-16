import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type {
  VenueSection,
  VenueSectionStatusPatch,
  VenueSectionUpsertBody,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import type { VenueSectionRecord } from "./venue-types.js";
import { VENUE_KEYS } from "./venue-types.js";
import { normalizeVenueCode } from "./venue-access.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

function toApiSection(row: VenueSectionRecord): VenueSection {
  return {
    id: row.sectionId,
    label: row.label,
    level: row.level,
    capacity: row.capacity,
    zone: row.zone,
    svgX: row.svgX,
    svgY: row.svgY,
    status: row.status,
    notes: row.notes,
    assignedOfficer: row.assignedOfficer,
    updatedAt: row.updatedAt,
  };
}

export async function listVenueSections(
  venueCode: string,
  agencyId: string,
): Promise<VenueSection[]> {
  const code = normalizeVenueCode(venueCode);
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: "agencyId = :aid",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.configPk(code),
        ":prefix": "SECTION#",
        ":aid": agencyId,
      },
    }),
  );

  return ((result.Items ?? []) as VenueSectionRecord[])
    .map(toApiSection)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export async function upsertVenueSection(opts: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  body: VenueSectionUpsertBody;
}): Promise<VenueSection> {
  const code = normalizeVenueCode(opts.venueCode);
  const now = new Date().toISOString();
  const sectionId = opts.body.id.trim();

  const existing = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.sectionSk(sectionId),
      },
    }),
  );

  const prior = existing.Item as VenueSectionRecord | undefined;
  if (prior && prior.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: VenueSectionRecord = {
    pk: VENUE_KEYS.configPk(code),
    sk: VENUE_KEYS.sectionSk(sectionId),
    agencyId: opts.agencyId,
    venueCode: code,
    sectionId,
    label: opts.body.label,
    level: opts.body.level,
    capacity: opts.body.capacity,
    zone: opts.body.zone,
    svgX: opts.body.svgX,
    svgY: opts.body.svgY,
    status: opts.body.status,
    notes: opts.body.notes,
    assignedOfficer: opts.body.assignedOfficer,
    updatedAt: opts.body.updatedAt ?? now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: item,
      ConditionExpression: prior ? "agencyId = :aid" : undefined,
      ExpressionAttributeValues: prior ? { ":aid": opts.agencyId } : undefined,
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.VENUE_SECTION_UPDATED,
    details: {
      venueCode: code,
      sectionId,
      label: item.label,
      action: prior ? "update" : "create",
    },
    createdAt: now,
    resourceType: "venue_section",
    resourceId: sectionId,
  });

  return toApiSection(item);
}

export async function patchVenueSectionStatus(opts: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  sectionId: string;
  patch: VenueSectionStatusPatch;
}): Promise<VenueSection> {
  const code = normalizeVenueCode(opts.venueCode);
  const now = new Date().toISOString();

  const existing = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.sectionSk(opts.sectionId),
      },
    }),
  );

  const prior = existing.Item as VenueSectionRecord | undefined;
  if (!prior || prior.agencyId !== opts.agencyId) {
    throw new Error("NOT_FOUND");
  }

  const item: VenueSectionRecord = {
    ...prior,
    status: opts.patch.status,
    notes: opts.patch.notes ?? prior.notes,
    assignedOfficer: opts.patch.assignedOfficer ?? prior.assignedOfficer,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: item,
      ConditionExpression: "agencyId = :aid",
      ExpressionAttributeValues: { ":aid": opts.agencyId },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.VENUE_SECTION_STATUS_CHANGED,
    details: {
      venueCode: code,
      sectionId: opts.sectionId,
      label: item.label,
      status: item.status,
    },
    createdAt: now,
    resourceType: "venue_section",
    resourceId: opts.sectionId,
  });

  return toApiSection(item);
}

export async function deleteVenueSection(opts: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  sectionId: string;
}): Promise<void> {
  const code = normalizeVenueCode(opts.venueCode);

  const existing = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.sectionSk(opts.sectionId),
      },
    }),
  );

  const prior = existing.Item as VenueSectionRecord | undefined;
  if (!prior || prior.agencyId !== opts.agencyId) {
    throw new Error("NOT_FOUND");
  }

  await ddb.send(
    new DeleteCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.sectionSk(opts.sectionId),
      },
      ConditionExpression: "agencyId = :aid",
      ExpressionAttributeValues: { ":aid": opts.agencyId },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.VENUE_SECTION_DELETED,
    details: {
      venueCode: code,
      sectionId: opts.sectionId,
      label: prior.label,
    },
    createdAt: new Date().toISOString(),
    resourceType: "venue_section",
    resourceId: opts.sectionId,
  });
}
