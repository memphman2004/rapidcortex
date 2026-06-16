import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { VenueProfile, VenueProfilePatch } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import type { VenueConfigRecord } from "./venue-types.js";
import { VENUE_KEYS } from "./venue-types.js";
import { normalizeVenueCode } from "./venue-access.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

function toApiProfile(row: VenueConfigRecord): VenueProfile {
  return {
    venueCode: row.venueCode,
    venueName: row.venueName,
    venueType: row.venueType,
    capacity: row.capacity,
    levels: row.levels,
    gateCount: row.gateCount,
    city: row.city,
    state: row.state,
    timezone: row.timezone,
    active: row.active,
    smsEnabled: row.smsEnabled,
    qrEnabled: row.qrEnabled,
  };
}

export async function getVenueProfile(
  venueCode: string,
  agencyId: string,
): Promise<VenueProfile | null> {
  const code = normalizeVenueCode(venueCode);
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.settingsSk(),
      },
    }),
  );

  const row = result.Item as VenueConfigRecord | undefined;
  if (!row || row.agencyId !== agencyId) return null;
  return toApiProfile(row);
}

export async function patchVenueProfile(opts: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  patch: VenueProfilePatch;
}): Promise<VenueProfile> {
  const code = normalizeVenueCode(opts.venueCode);
  const now = new Date().toISOString();

  const existing = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: VENUE_KEYS.settingsSk(),
      },
    }),
  );

  const prior = existing.Item as VenueConfigRecord | undefined;
  if (prior && prior.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: VenueConfigRecord = {
    pk: VENUE_KEYS.configPk(code),
    sk: VENUE_KEYS.settingsSk(),
    agencyId: opts.agencyId,
    venueCode: code,
    venueName: opts.patch.venueName ?? prior?.venueName ?? code,
    active: opts.patch.active ?? prior?.active ?? true,
    smsEnabled: opts.patch.smsEnabled ?? prior?.smsEnabled ?? true,
    qrEnabled: opts.patch.qrEnabled ?? prior?.qrEnabled ?? true,
    venueType: opts.patch.venueType ?? prior?.venueType,
    capacity: opts.patch.capacity ?? prior?.capacity,
    levels: opts.patch.levels ?? prior?.levels,
    gateCount: opts.patch.gateCount ?? prior?.gateCount,
    city: opts.patch.city ?? prior?.city,
    state: opts.patch.state ?? prior?.state,
    timezone: opts.patch.timezone ?? prior?.timezone,
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: item,
      ...(prior
        ? {
            ConditionExpression: "agencyId = :aid",
            ExpressionAttributeValues: { ":aid": opts.agencyId },
          }
        : {}),
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.VENUE_PROFILE_UPDATED,
    details: {
      venueCode: code,
      fields: Object.keys(opts.patch),
    },
    createdAt: now,
    resourceType: "venue_profile",
    resourceId: code,
  });

  return toApiProfile(item);
}
