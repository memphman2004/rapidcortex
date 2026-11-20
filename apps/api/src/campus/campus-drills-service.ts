/**
 * Campus K-12 Safety Drill Tracking Service
 *
 * Tracks required safety drills per CISA and state fire/safety code requirements.
 * Provides compliance reporting for state audit.
 */
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  campusDrillRecordSchema,
  computeDrillCompliance,
  getCurrentSchoolYear,
  type CampusDrillCreateBody,
  type CampusDrillListQuery,
  type CampusDrillRecord,
  type CampusDrillComplianceSummary,
} from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function isCampusDrillsTableConfigured(): boolean {
  return Boolean(process.env.CAMPUS_DRILLS_TABLE?.trim());
}

function drillsTable(): string {
  const t = process.env.CAMPUS_DRILLS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_DRILLS_TABLE not set");
  return t;
}

/** DynamoDB key shape: pk = AGENCY#{agencyId}, sk = DRILL#{schoolYear}#{drillId} */
function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}
function sk(schoolYear: string, drillId: string): string {
  return `DRILL#${schoolYear}#${drillId}`;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getDrill(
  agencyId: string,
  drillId: string,
  schoolYear: string,
): Promise<CampusDrillRecord | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: drillsTable(),
      Key: { pk: pk(agencyId), sk: sk(schoolYear, drillId) },
    }),
  );
  return (result.Item as CampusDrillRecord) ?? null;
}

export async function listDrills(
  agencyId: string,
  query: CampusDrillListQuery = {},
): Promise<CampusDrillRecord[]> {
  const schoolYear = query.schoolYear ?? getCurrentSchoolYear();
  const result = await ddb.send(
    new QueryCommand({
      TableName: drillsTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": pk(agencyId),
        ":prefix": `DRILL#${schoolYear}#`,
      },
    }),
  );
  let items = (result.Items ?? []) as CampusDrillRecord[];
  if (query.siteId) {
    items = items.filter((d) => d.siteId === query.siteId);
  }
  if (query.type) {
    items = items.filter((d) => d.type === query.type);
  }
  if (query.status) {
    items = items.filter((d) => d.status === query.status);
  }
  return items;
}

export async function getDrillCompliance(
  agencyId: string,
  siteId: string,
  schoolYear?: string,
): Promise<CampusDrillComplianceSummary> {
  const year = schoolYear ?? getCurrentSchoolYear();
  const drills = await listDrills(agencyId, { schoolYear: year, siteId });
  return computeDrillCompliance(drills, siteId, year);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateDrillOptions {
  agencyId: string;
  body: CampusDrillCreateBody;
  createdBy: string;
}

export async function createDrill(opts: CreateDrillOptions): Promise<CampusDrillRecord> {
  const { agencyId, body, createdBy } = opts;
  const drillId = randomUUID();
  const now = new Date().toISOString();

  const record: CampusDrillRecord = campusDrillRecordSchema.parse({
    drillId,
    agencyId,
    siteId: body.siteId,
    type: body.type,
    status: body.status ?? "completed",
    schoolYear: body.schoolYear,
    scheduledAt: body.scheduledAt,
    conductedAt: body.conductedAt,
    durationMinutes: body.durationMinutes,
    participantCount: body.participantCount,
    conductedBy: body.conductedBy,
    issues: body.issues,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
  });

  await ddb.send(
    new PutCommand({
      TableName: drillsTable(),
      Item: {
        pk: pk(agencyId),
        sk: sk(record.schoolYear, drillId),
        ...record,
      },
    }),
  );

  return record;
}

export async function updateDrill(
  agencyId: string,
  drillId: string,
  schoolYear: string,
  patch: Partial<CampusDrillCreateBody>,
  updatedBy: string,
): Promise<CampusDrillRecord> {
  const existing = await getDrill(agencyId, drillId, schoolYear);
  if (!existing) throw new Error(`Drill ${drillId} not found`);

  const now = new Date().toISOString();
  const updated: CampusDrillRecord = campusDrillRecordSchema.parse({
    ...existing,
    ...patch,
    drillId,
    agencyId,
    updatedAt: now,
    updatedBy,
  });

  await ddb.send(
    new PutCommand({
      TableName: drillsTable(),
      Item: {
        pk: pk(agencyId),
        sk: sk(updated.schoolYear, drillId),
        ...updated,
      },
    }),
  );
  return updated;
}
