/**
 * Feature 1: Citizen Safety Registry
 * Feature 2: Address Intelligence Layer
 *
 * Integration export: depositIncidentIntelligence
 */

import { randomUUID } from "crypto";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import {
  FEATURES_AUDIT_EVENT_TYPES,
  registerCitizenRequestSchema,
  updateCitizenRequestSchema,
  depositIncidentIntelligenceRequestSchema,
  floorPlanUploadUrlRequestSchema,
  type CitizenProfile,
  type AddressIntelligence,
  type AddressHazard,
  type AddressPrePlan,
} from "rapid-cortex-shared";
import {
  ddb,
  s3,
  comprehend,
  FeatureTables,
  FeatureBuckets,
  CitizenKeys,
  AddressKeys,
  encodeGeohash,
  normalizePhone,
  normalizeAddress,
} from "./tables.js";
import {
  FeatureError,
  featureBadRequest,
  featureConflict,
  featureForbidden,
  featureNotFound,
  writeFeatureAudit,
  type FeatureActor,
} from "./errors.js";

async function scrubFreeText(text: string): Promise<string> {
  try {
    const res = await comprehend.send(
      new DetectPiiEntitiesCommand({ Text: text, LanguageCode: "en" }),
    );
    let result = text;
    const sorted = [...(res.Entities ?? [])].sort(
      (a, b) => (b.EndOffset ?? 0) - (a.EndOffset ?? 0),
    );
    for (const entity of sorted) {
      if (
        entity.BeginOffset !== undefined &&
        entity.EndOffset !== undefined &&
        (entity.Score ?? 0) > 0.85
      ) {
        result =
          result.slice(0, entity.BeginOffset) +
          "[REDACTED]" +
          result.slice(entity.EndOffset);
      }
    }
    return result;
  } catch (err) {
    console.warn("[features] Comprehend PII scrub failed; using original text", err);
    return text;
  }
}

function buildIntelSummary(intel: AddressIntelligence): string {
  const parts: string[] = [];
  if (intel.totalIncidents > 0) {
    parts.push(`${intel.totalIncidents} prior incident${intel.totalIncidents > 1 ? "s" : ""}`);
  }
  if (intel.hazards?.length > 0) {
    parts.push(`${intel.hazards.length} hazard flag${intel.hazards.length > 1 ? "s" : ""}`);
  }
  if (intel.hasNonAmbulatoryOccupant) parts.push("non-ambulatory occupant on record");
  if (intel.hasSpecialNeedsOccupant) parts.push("special needs occupant on record");
  if (intel.prePlan) parts.push(`pre-plan available (${intel.prePlan.facilityType})`);
  if (intel.gateCode || intel.accessNotes) parts.push("access notes on file");
  return parts.length > 0 ? parts.join(" · ") : "No prior intelligence on record";
}

export async function registerCitizen(
  actor: FeatureActor,
  bodyUnknown: unknown,
): Promise<{ profileId: string; message: string }> {
  const agencyId = actor.agencyId;
  const raw = typeof bodyUnknown === "object" && bodyUnknown ? (bodyUnknown as Record<string, unknown>) : {};
  const parsed = registerCitizenRequestSchema.safeParse({
    primaryLanguage: "en-US",
    mobilityStatus: "ambulatory",
    enrolledVia: "web",
    consentSignedAt: new Date().toISOString(),
    agencyIds: [],
    ...raw,
  });
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const body = parsed.data;

  const phoneE164 = normalizePhone(body.phoneE164);
  const profileId = randomUUID();
  const now = new Date().toISOString();
  const agencyIds = Array.from(
    new Set([agencyId, ...(body.agencyIds ?? []).filter(Boolean)]),
  );

  const accessNotes = body.accessNotes ? await scrubFreeText(body.accessNotes) : undefined;
  const specialInstructions = body.specialInstructions
    ? await scrubFreeText(body.specialInstructions)
    : undefined;

  const normalizedAddress = normalizeAddress(
    body.address.street,
    body.address.city,
    body.address.state,
    body.address.zip,
  );

  const profile: CitizenProfile = {
    ...body,
    pk: CitizenKeys.profile(phoneE164).pk,
    sk: "PROFILE",
    profileId,
    phoneE164,
    accessNotes,
    specialInstructions,
    agencyIds,
    consentSignedAt: body.consentSignedAt ?? now,
    medicalConditions: body.medicalConditions,
    communicationNeeds: body.communicationNeeds,
    householdMembers: body.householdMembers,
    pets: body.pets,
    createdAt: now,
    lastUpdatedAt: now,
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: FeatureTables.citizens(),
        Item: { ...profile, normalizedAddress },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === "ConditionalCheckFailedException") {
      throw featureConflict(
        "A profile with this phone number already exists. Use PUT to update.",
      );
    }
    throw e;
  }

  await ddb.send(
    new PutCommand({
      TableName: FeatureTables.citizens(),
      Item: {
        ...CitizenKeys.agencyRef(agencyId, profileId),
        profileId,
        phoneE164,
        agencyId,
        createdAt: now,
      },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.CITIZEN_REGISTERED,
    details: { profileId, phoneE164 },
    resourceType: "user",
    resourceId: profileId,
  });

  return { profileId, message: "Citizen profile registered" };
}

export async function lookupCitizen(
  actor: FeatureActor,
  query: { phone?: string; address?: string },
): Promise<{ found: boolean; profile?: CitizenProfile }> {
  const agencyId = actor.agencyId;
  if (!query.phone && !query.address) {
    throw featureBadRequest("Provide phone or address query parameter");
  }

  let profile: CitizenProfile | null = null;

  if (query.phone) {
    const phoneE164 = normalizePhone(query.phone);
    const res = await ddb.send(
      new GetCommand({
        TableName: FeatureTables.citizens(),
        Key: CitizenKeys.profile(phoneE164),
      }),
    );
    profile = (res.Item as CitizenProfile) ?? null;
  }

  if (!profile && query.address) {
    const normalized = query.address.toLowerCase().trim();
    try {
      const res = await ddb.send(
        new QueryCommand({
          TableName: FeatureTables.citizens(),
          IndexName: "address-index",
          KeyConditionExpression: "normalizedAddress = :addr",
          ExpressionAttributeValues: { ":addr": normalized },
          Limit: 5,
        }),
      );
      profile = (res.Items?.[0] as CitizenProfile) ?? null;
    } catch (err) {
      console.warn("[features] address-index query failed", err);
    }
  }

  if (!profile) return { found: false };

  if (!profile.agencyIds?.includes(agencyId)) {
    throw featureForbidden("Profile is not shared with your agency");
  }

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.CITIZEN_UPDATED,
    details: { profileId: profile.profileId, matchedOn: query.phone ? "phone" : "address" },
    resourceId: profile.profileId,
  });

  return { found: true, profile };
}

async function resolveCitizenByProfileId(
  agencyId: string,
  profileId: string,
): Promise<{ phoneE164: string; profile: CitizenProfile }> {
  const ref = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.citizens(),
      Key: CitizenKeys.agencyRef(agencyId, profileId),
    }),
  );
  const phoneE164 = ref.Item?.phoneE164 as string | undefined;
  if (!phoneE164) throw featureNotFound("Citizen profile not found");

  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.citizens(),
      Key: CitizenKeys.profile(phoneE164),
    }),
  );
  const profile = res.Item as CitizenProfile | undefined;
  if (!profile) throw featureNotFound("Citizen profile not found");
  if (!profile.agencyIds?.includes(agencyId)) {
    throw featureForbidden("Profile is not shared with your agency");
  }
  return { phoneE164, profile };
}

export async function updateCitizenProfile(
  actor: FeatureActor,
  profileId: string,
  bodyUnknown: unknown,
): Promise<{ updated: boolean; updatedAt: string }> {
  const agencyId = actor.agencyId;
  const parsed = updateCitizenRequestSchema.safeParse(bodyUnknown ?? {});
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const updates = { ...parsed.data } as Record<string, unknown>;

  const { phoneE164 } = await resolveCitizenByProfileId(agencyId, profileId);
  const now = new Date().toISOString();

  if (typeof updates.accessNotes === "string") {
    updates.accessNotes = await scrubFreeText(updates.accessNotes);
  }
  if (typeof updates.specialInstructions === "string") {
    updates.specialInstructions = await scrubFreeText(updates.specialInstructions);
  }

  // Never allow agencyIds overwrite from body without ensuring caller agency stays
  delete updates.agencyIds;
  delete updates.pk;
  delete updates.sk;
  delete updates.profileId;
  delete updates.createdAt;
  delete updates.phoneE164;

  const keys = Object.keys(updates);
  if (keys.length === 0) throw featureBadRequest("No updatable fields provided");

  const UpdateExpression =
    "SET " + keys.map((k, i) => `#k${i} = :v${i}`).join(", ") + ", lastUpdatedAt = :now";
  const ExpressionAttributeNames = Object.fromEntries(keys.map((k, i) => [`#k${i}`, k]));
  const ExpressionAttributeValues = {
    ...Object.fromEntries(keys.map((k, i) => [`:v${i}`, updates[k]])),
    ":now": now,
    ":agencyId": agencyId,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.citizens(),
      Key: CitizenKeys.profile(phoneE164),
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ConditionExpression: "attribute_exists(pk) AND contains(agencyIds, :agencyId)",
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.CITIZEN_UPDATED,
    details: { profileId, fields: keys },
    resourceId: profileId,
  });

  return { updated: true, updatedAt: now };
}

export async function deleteCitizenProfile(
  actor: FeatureActor,
  profileId: string,
): Promise<{ deleted: boolean; message: string }> {
  const agencyId = actor.agencyId;
  const { phoneE164, profile } = await resolveCitizenByProfileId(agencyId, profileId);

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: FeatureTables.citizens(),
        Key: CitizenKeys.profile(phoneE164),
        ConditionExpression: "attribute_exists(pk) AND contains(agencyIds, :agencyId)",
        ExpressionAttributeValues: { ":agencyId": agencyId },
      }),
    );
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === "ConditionalCheckFailedException") {
      throw featureNotFound("Profile not found");
    }
    throw e;
  }

  await ddb.send(
    new DeleteCommand({
      TableName: FeatureTables.citizens(),
      Key: CitizenKeys.agencyRef(agencyId, profileId),
    }),
  ).catch(() => undefined);

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.CITIZEN_DELETED,
    details: { profileId, phoneE164 },
    resourceId: profileId,
  });

  void profile;
  return { deleted: true, message: "Citizen profile removed per right-to-delete request" };
}

export async function getAddressIntelligence(
  actor: FeatureActor,
  normalized: string,
  coords?: { lat?: number; lon?: number },
): Promise<{
  found: boolean;
  normalizedAddress: string;
  intelligence: AddressIntelligence | null;
  citizenProfiles: CitizenProfile[];
  summary?: string;
}> {
  const agencyId = actor.agencyId;
  const normalizedAddress = decodeURIComponent(normalized).toLowerCase().trim();

  const res = await ddb.send(
    new GetCommand({
      TableName: FeatureTables.address(),
      Key: AddressKeys.unit(agencyId, normalizedAddress),
    }),
  );

  let citizenProfiles: CitizenProfile[] = [];
  try {
    const citizenRes = await ddb.send(
      new QueryCommand({
        TableName: FeatureTables.citizens(),
        IndexName: "address-index",
        KeyConditionExpression: "normalizedAddress = :addr",
        FilterExpression: "contains(agencyIds, :agencyId)",
        ExpressionAttributeValues: { ":addr": normalizedAddress, ":agencyId": agencyId },
      }),
    );
    citizenProfiles = (citizenRes.Items ?? []) as CitizenProfile[];
  } catch {
    citizenProfiles = [];
  }

  if (!res.Item) {
    void coords;
    return {
      found: false,
      normalizedAddress,
      intelligence: null,
      citizenProfiles,
    };
  }

  const intel = res.Item as AddressIntelligence;
  return {
    found: true,
    normalizedAddress,
    intelligence: intel,
    citizenProfiles,
    summary: buildIntelSummary(intel),
  };
}

/**
 * Records a new incident against an address — called by incident-close / integration paths.
 * agencyId must be provided by the trusted caller (system Lambda), not from an untrusted body in HTTP.
 */
export async function depositIncidentIntelligence(input: {
  agencyId: string;
  address: { street: string; city: string; state: string; zip: string };
  incidentId: string;
  incidentType: string;
  priority?: number;
  disposition?: string;
  notes?: string;
  lat: number;
  lon: number;
  actorId?: string;
}): Promise<{ deposited: boolean }> {
  const parsed = depositIncidentIntelligenceRequestSchema.safeParse({
    address: input.address,
    incidentId: input.incidentId,
    incidentType: input.incidentType,
    priority: input.priority ?? 3,
    disposition: input.disposition,
    notes: input.notes,
    lat: input.lat,
    lon: input.lon,
  });
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const body = { ...parsed.data, agencyId: input.agencyId };

  const normalized = normalizeAddress(
    body.address.street,
    body.address.city,
    body.address.state,
    body.address.zip,
  );
  const geohash8 = encodeGeohash(body.lat, body.lon, 8);
  const now = new Date().toISOString();
  const newEntry = {
    incidentId: body.incidentId,
    incidentType: body.incidentType,
    priority: body.priority ?? 0,
    date: now,
    disposition: body.disposition,
    notes: body.notes,
  };

  const key = AddressKeys.unit(body.agencyId, normalized);
  const existing = await ddb.send(
    new GetCommand({ TableName: FeatureTables.address(), Key: key }),
  );
  const prior = (existing.Item as AddressIntelligence | undefined)?.incidentHistory ?? [];
  const history = [...prior, newEntry].slice(-100);

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.address(),
      Key: key,
      UpdateExpression: `
        SET normalizedAddress = :norm,
            addressId = if_not_exists(addressId, :aid),
            lat = :lat,
            lon = :lon,
            geohash = :gh,
            lastIncidentAt = :now,
            updatedAt = :now,
            createdAt = if_not_exists(createdAt, :now),
            incidentHistory = :history,
            totalIncidents = if_not_exists(totalIncidents, :zero) + :one,
            incidentTypeBreakdown = if_not_exists(incidentTypeBreakdown, :emptyMap)
      `,
      ExpressionAttributeValues: {
        ":norm": normalized,
        ":aid": randomUUID(),
        ":lat": body.lat,
        ":lon": body.lon,
        ":gh": geohash8,
        ":now": now,
        ":zero": 0,
        ":one": 1,
        ":history": history,
        ":emptyMap": {},
      },
    }),
  );

  await writeFeatureAudit({
    agencyId: body.agencyId,
    actorId: input.actorId ?? "system:depositIncidentIntelligence",
    type: FEATURES_AUDIT_EVENT_TYPES.ADDRESS_INTEL_DEPOSITED,
    details: { incidentId: body.incidentId, normalizedAddress: normalized },
    incidentId: body.incidentId,
  });

  return { deposited: true };
}

const hazardSchema = z.object({
  type: z.enum([
    "hazmat",
    "structural",
    "electrical",
    "gas",
    "water",
    "biological",
    "violence_history",
    "dog",
    "other",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(1),
  expiresAt: z.string().optional(),
});

export async function addAddressHazard(
  actor: FeatureActor,
  normalized: string,
  bodyUnknown: unknown,
): Promise<{ hazardId: string }> {
  const agencyId = actor.agencyId;
  const parsed = hazardSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const normalizedAddress = decodeURIComponent(normalized).toLowerCase().trim();
  const now = new Date().toISOString();

  const newHazard: AddressHazard = {
    hazardId: randomUUID(),
    ...parsed.data,
    addedAt: now,
    addedBy: actor.userId,
    verified: false,
  };

  const key = AddressKeys.unit(agencyId, normalizedAddress);
  const existing = await ddb.send(
    new GetCommand({ TableName: FeatureTables.address(), Key: key }),
  );
  const hazards = [
    ...((existing.Item as AddressIntelligence | undefined)?.hazards ?? []),
    newHazard,
  ];

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.address(),
      Key: key,
      UpdateExpression:
        "SET hazards = :hazards, updatedAt = :now, createdAt = if_not_exists(createdAt, :now), normalizedAddress = if_not_exists(normalizedAddress, :norm), addressId = if_not_exists(addressId, :aid)",
      ExpressionAttributeValues: {
        ":hazards": hazards,
        ":now": now,
        ":norm": normalizedAddress,
        ":aid": randomUUID(),
      },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.ADDRESS_HAZARD_ADDED,
    details: { hazardId: newHazard.hazardId, normalizedAddress },
    resourceId: newHazard.hazardId,
  });

  return { hazardId: newHazard.hazardId };
}

const prePlanSchema = z
  .object({
    prePlanId: z.string().optional(),
    buildingName: z.string().optional(),
    facilityType: z.enum([
      "residential",
      "commercial",
      "school",
      "hospital",
      "government",
      "industrial",
      "religious",
      "other",
    ]),
    occupancy: z.string().optional(),
    constructionType: z.string().optional(),
    floors: z.number().optional(),
    totalSqFt: z.number().optional(),
    contacts: z.array(z.record(z.unknown())).default([]),
    notes: z.string().optional(),
  })
  .passthrough();

export async function upsertPrePlan(
  actor: FeatureActor,
  normalized: string,
  bodyUnknown: unknown,
): Promise<{ prePlanId: string }> {
  const agencyId = actor.agencyId;
  const parsed = prePlanSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const normalizedAddress = decodeURIComponent(normalized).toLowerCase().trim();
  const now = new Date().toISOString();

  const prePlan = {
    ...parsed.data,
    prePlanId: parsed.data.prePlanId ?? randomUUID(),
    contacts: parsed.data.contacts as AddressPrePlan["contacts"],
    createdAt: (parsed.data as { createdAt?: string }).createdAt ?? now,
    updatedAt: now,
  } as AddressPrePlan;

  await ddb.send(
    new UpdateCommand({
      TableName: FeatureTables.address(),
      Key: AddressKeys.unit(agencyId, normalizedAddress),
      UpdateExpression:
        "SET prePlan = :pp, updatedAt = :now, createdAt = if_not_exists(createdAt, :now), normalizedAddress = if_not_exists(normalizedAddress, :norm), addressId = if_not_exists(addressId, :aid)",
      ExpressionAttributeValues: {
        ":pp": prePlan,
        ":now": now,
        ":norm": normalizedAddress,
        ":aid": randomUUID(),
      },
    }),
  );

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.ADDRESS_PREPLAN_UPSERTED,
    details: { prePlanId: prePlan.prePlanId, normalizedAddress },
    resourceId: prePlan.prePlanId,
  });

  return { prePlanId: prePlan.prePlanId };
}

export async function getFloorPlanUploadUrl(
  actor: FeatureActor,
  normalized: string,
  bodyUnknown: unknown,
): Promise<{ uploadUrl: string; s3Key: string; cdnUrl?: string }> {
  const agencyId = actor.agencyId;
  const bucket = FeatureBuckets.preplan();
  if (!bucket) throw new FeatureError(503, "PREPLAN_BUCKET is not configured");

  const parsed = floorPlanUploadUrlRequestSchema.safeParse(bodyUnknown);
  if (!parsed.success) throw featureBadRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  void normalized;

  const key = `preplan/${agencyId}/${parsed.data.prePlanId}/floor-${parsed.data.level}-${randomUUID()}.pdf`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: parsed.data.mimeType ?? "application/pdf",
    }),
    { expiresIn: 900 },
  );

  const cdn = FeatureBuckets.preplanCdn();
  return {
    uploadUrl: url,
    s3Key: key,
    ...(cdn ? { cdnUrl: `https://${cdn}/${key}` } : {}),
  };
}
