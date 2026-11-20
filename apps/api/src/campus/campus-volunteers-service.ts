/**
 * Campus K-12 Volunteer & Contractor Management Service
 *
 * Tracks recurring visitors (parent volunteers, coaches, tutors, contractors)
 * including background check status and NSOPW screening.
 *
 * IMPORTANT: NexCort iQ records background check status as reported by the
 * district. It does NOT conduct background checks. Access decisions are
 * always made by human staff — never automated based on status alone.
 */
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  campusVolunteerRecordSchema,
  getVolunteerAccessAdvisory,
  searchNsopw,
  type CampusBgCheckStatus,
  type CampusVolunteerRecord,
  type CampusVolunteerSummary,
  type CampusVolunteerUpsertBody,
} from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function isCampusVolunteersTableConfigured(): boolean {
  return Boolean(process.env.CAMPUS_VOLUNTEERS_TABLE?.trim());
}

function volunteersTable(): string {
  const t = process.env.CAMPUS_VOLUNTEERS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_VOLUNTEERS_TABLE not set");
  return t;
}

/** DynamoDB key shape: pk = AGENCY#{agencyId}, sk = VOL#{volunteerId} */
function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}
function sk(volunteerId: string): string {
  return `VOL#${volunteerId}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getVolunteer(
  agencyId: string,
  volunteerId: string,
): Promise<CampusVolunteerRecord | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: volunteersTable(),
      Key: { pk: pk(agencyId), sk: sk(volunteerId) },
    }),
  );
  if (!result.Item) return null;
  return result.Item as CampusVolunteerRecord;
}

export interface ListVolunteersOptions {
  bgCheckStatus?: CampusBgCheckStatus;
  role?: string;
  includeArchived?: boolean;
}

export async function listVolunteers(
  agencyId: string,
  options: ListVolunteersOptions = {},
): Promise<CampusVolunteerSummary[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: volunteersTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": pk(agencyId),
        ":prefix": "VOL#",
      },
    }),
  );
  let items = (result.Items ?? []) as CampusVolunteerRecord[];
  // Filter archived unless explicitly requested
  if (!options.includeArchived) {
    items = items.filter((v) => !v.archivedAt);
  }
  if (options.bgCheckStatus) {
    items = items.filter((v) => v.bgCheckStatus === options.bgCheckStatus);
  }
  if (options.role) {
    items = items.filter((v) => v.role === options.role);
  }
  // Return summary (strip notes field)
  return items.map(
    ({
      volunteerId,
      agencyId: a,
      firstName,
      lastName,
      role,
      bgCheckStatus,
      bgCheckExpiresAt,
      nsopwStatus,
      nsopwCheckedAt,
      allowedSites,
      createdAt,
      updatedAt,
      archivedAt,
    }): CampusVolunteerSummary => ({
      volunteerId,
      agencyId: a,
      firstName,
      lastName,
      role,
      bgCheckStatus,
      bgCheckExpiresAt,
      nsopwStatus,
      nsopwCheckedAt,
      allowedSites,
      createdAt,
      updatedAt,
      archivedAt,
    }),
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateVolunteerOptions {
  agencyId: string;
  body: CampusVolunteerUpsertBody;
  createdBy: string;
  /** If false, skip NSOPW check at creation (default: true). */
  runNsopw?: boolean;
}

export interface CreateVolunteerResult {
  volunteer: CampusVolunteerRecord;
  /** Advisory only — human makes the access decision. */
  accessAdvisory: ReturnType<typeof getVolunteerAccessAdvisory>;
}

export async function createVolunteer(
  opts: CreateVolunteerOptions,
): Promise<CreateVolunteerResult> {
  const { agencyId, body, createdBy } = opts;
  const runNsopw = opts.runNsopw !== false;

  const volunteerId = randomUUID();
  const now = new Date().toISOString();

  // Run NSOPW check if enabled (and not in mock mode)
  let nsopwStatus: CampusVolunteerRecord["nsopwStatus"] = "not_checked";
  let nsopwCheckedAt: string | undefined;
  let nsopwMatchCount: number | undefined;

  if (runNsopw) {
    try {
      const result = await searchNsopw({
        firstName: body.firstName,
        lastName: body.lastName,
      });
      nsopwMatchCount = result.matchCount ?? 0;
      nsopwCheckedAt = now;
      if (result.apiError) {
        nsopwStatus = "review_required";
      } else {
        nsopwStatus = nsopwMatchCount > 0 ? "flagged" : "cleared";
      }
    } catch (err) {
      // NSOPW API unavailable — set review_required, don't block creation
      console.warn("[campus-volunteers] NSOPW check failed", err);
      nsopwStatus = "review_required";
      nsopwCheckedAt = now;
    }
  }

  const record: CampusVolunteerRecord = campusVolunteerRecordSchema.parse({
    agencyId,
    volunteerId,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    email: body.email,
    role: body.role,
    allowedSites: body.allowedSites ?? [],
    bgCheckStatus: body.bgCheckStatus ?? "not_required",
    bgCheckExpiresAt: body.bgCheckExpiresAt,
    bgCheckProvider: body.bgCheckProvider,
    bgCheckUpdatedAt: body.bgCheckStatus ? now : undefined,
    bgCheckUpdatedBy: body.bgCheckStatus ? createdBy : undefined,
    nsopwStatus,
    nsopwCheckedAt,
    nsopwMatchCount,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
  });

  await ddb.send(
    new PutCommand({
      TableName: volunteersTable(),
      Item: { pk: pk(agencyId), sk: sk(volunteerId), ...record },
    }),
  );

  return {
    volunteer: record,
    accessAdvisory: getVolunteerAccessAdvisory(record),
  };
}

export interface UpdateVolunteerOptions {
  agencyId: string;
  volunteerId: string;
  patch: Partial<CampusVolunteerUpsertBody & { archivedAt?: string }>;
  updatedBy: string;
}

export async function updateVolunteer(opts: UpdateVolunteerOptions): Promise<CampusVolunteerRecord> {
  const { agencyId, volunteerId, patch, updatedBy } = opts;
  const existing = await getVolunteer(agencyId, volunteerId);
  if (!existing) throw new Error(`Volunteer ${volunteerId} not found`);

  const now = new Date().toISOString();
  const updated: CampusVolunteerRecord = campusVolunteerRecordSchema.parse({
    ...existing,
    ...patch,
    agencyId,
    volunteerId,
    updatedAt: now,
    updatedBy,
    // Track who updated bg check status
    bgCheckUpdatedAt: patch.bgCheckStatus ? now : existing.bgCheckUpdatedAt,
    bgCheckUpdatedBy: patch.bgCheckStatus ? updatedBy : existing.bgCheckUpdatedBy,
  });

  await ddb.send(
    new PutCommand({
      TableName: volunteersTable(),
      Item: { pk: pk(agencyId), sk: sk(volunteerId), ...updated },
    }),
  );
  return updated;
}

export interface NsopwRecheckResult {
  volunteer: CampusVolunteerRecord;
  nsopwStatus: CampusVolunteerRecord["nsopwStatus"];
  accessAdvisory: ReturnType<typeof getVolunteerAccessAdvisory>;
}

export async function recheckVolunteerNsopw(
  agencyId: string,
  volunteerId: string,
  updatedBy: string,
): Promise<NsopwRecheckResult> {
  const existing = await getVolunteer(agencyId, volunteerId);
  if (!existing) throw new Error(`Volunteer ${volunteerId} not found`);

  const now = new Date().toISOString();
  let nsopwStatus: CampusVolunteerRecord["nsopwStatus"] = "review_required";
  let nsopwMatchCount: number | undefined;

  try {
    const result = await searchNsopw({
      firstName: existing.firstName,
      lastName: existing.lastName,
    });
    nsopwMatchCount = result.matchCount ?? 0;
    if (result.apiError) {
      nsopwStatus = "review_required";
    } else {
      nsopwStatus = nsopwMatchCount > 0 ? "flagged" : "cleared";
    }
  } catch (err) {
    console.warn("[campus-volunteers] NSOPW re-check failed", err);
  }

  // Write update directly via PutItem to include nsopwMatchCount (not in upsert body schema)
  const freshRecord: CampusVolunteerRecord = campusVolunteerRecordSchema.parse({
    ...existing,
    nsopwStatus,
    nsopwCheckedAt: now,
    nsopwMatchCount,
    updatedAt: now,
    updatedBy,
  });
  await ddb.send(
    new PutCommand({
      TableName: volunteersTable(),
      Item: { pk: pk(agencyId), sk: sk(volunteerId), ...freshRecord },
    }),
  );
  const updated = freshRecord;

  return {
    volunteer: updated,
    nsopwStatus,
    accessAdvisory: getVolunteerAccessAdvisory(updated),
  };
}

export async function archiveVolunteer(
  agencyId: string,
  volunteerId: string,
  updatedBy: string,
): Promise<void> {
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: volunteersTable(),
      Key: { pk: pk(agencyId), sk: sk(volunteerId) },
      UpdateExpression: "SET archivedAt = :a, updatedAt = :u, updatedBy = :b",
      ConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":a": now,
        ":u": now,
        ":b": updatedBy,
        ":pk": pk(agencyId),
        ":sk": sk(volunteerId),
      },
    }),
  );
}
