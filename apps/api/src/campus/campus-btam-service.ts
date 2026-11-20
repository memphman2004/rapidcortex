/**
 * BTAM (Behavioral Threat Assessment & Management) DynamoDB service — K-12 only.
 *
 * DynamoDB key shape:
 *   PK = AGENCY#{agencyId}
 *   SK = BTAM#{caseId}
 *
 * agencyId is ALWAYS from the verified JWT — never from request input.
 */

import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  BtamAddActionBody,
  BtamCaseRecord,
  BtamOpenCaseBody,
  BtamPatchCaseBody,
} from "rapid-cortex-shared";
import { btamCaseRecordSchema } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ─── Table config ─────────────────────────────────────────────────────────────

export function isCampusBtamTableConfigured(): boolean {
  return Boolean(process.env.CAMPUS_BTAM_TABLE?.trim());
}

function btamTable(): string {
  const t = process.env.CAMPUS_BTAM_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_BTAM_TABLE not set");
  return t;
}

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(caseId: string): string {
  return `BTAM#${caseId}`;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function openBtamCase(
  agencyId: string,
  body: BtamOpenCaseBody,
  actorId: string,
  actorName?: string,
): Promise<BtamCaseRecord> {
  const caseId = `btam_${randomUUID().replace(/-/g, "")}`;
  const now = new Date().toISOString();

  const record = btamCaseRecordSchema.parse({
    caseId,
    agencyId,
    campusCode: body.campusCode,
    status: "open",
    concernTypes: body.concernTypes,
    referralSource: body.referralSource,
    subjectLabel: body.subjectLabel,
    subjectGrade: body.subjectGrade,
    notes: body.notes,
    linkedIncidentId: body.linkedIncidentId,
    assignedTo: body.assignedTo,
    assignedToName: body.assignedToName,
    confidential: true,
    actions: [
      {
        actionId: randomUUID(),
        type: "note_added",
        description: `Case opened by ${actorName ?? actorId}. Referral source: ${body.referralSource}.`,
        performedBy: actorId,
        performedByName: actorName,
        performedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  });

  await ddb.send(
    new PutCommand({
      TableName: btamTable(),
      Item: { pk: pk(agencyId), sk: sk(caseId), ...record },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );

  return record;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getBtamCase(
  agencyId: string,
  caseId: string,
): Promise<BtamCaseRecord | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: btamTable(),
      Key: { pk: pk(agencyId), sk: sk(caseId) },
    }),
  );
  if (!result.Item) return null;
  const parsed = btamCaseRecordSchema.safeParse(result.Item);
  if (!parsed.success) return null;
  return parsed.data;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listBtamCases(
  agencyId: string,
  opts: {
    campusCode?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<{ cases: BtamCaseRecord[]; cursor?: string; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const result = await ddb.send(
    new QueryCommand({
      TableName: btamTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk(agencyId), ":prefix": "BTAM#" },
      Limit: limit + 1,
      ExclusiveStartKey: opts.cursor
        ? JSON.parse(Buffer.from(opts.cursor, "base64").toString())
        : undefined,
      ScanIndexForward: false,
    }),
  );

  let items = (result.Items ?? []) as (BtamCaseRecord & { pk: string; sk: string })[];

  // Filter by campusCode (tenant sub-scoping for multi-site agencies)
  if (opts.campusCode) {
    items = items.filter((i) => i.campusCode === opts.campusCode);
  }
  if (opts.status) {
    items = items.filter((i) => i.status === opts.status);
  }

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

  const cases = page
    .map((item) => {
      const parsed = btamCaseRecordSchema.safeParse(item);
      return parsed.success ? parsed.data : null;
    })
    .filter((c): c is BtamCaseRecord => c !== null);

  return { cases, cursor: nextCursor, total: cases.length };
}

// ─── Patch ────────────────────────────────────────────────────────────────────

export async function patchBtamCase(
  agencyId: string,
  caseId: string,
  body: BtamPatchCaseBody,
  actorId: string,
  actorName?: string,
): Promise<BtamCaseRecord | null> {
  const existing = await getBtamCase(agencyId, caseId);
  if (!existing) return null;

  const now = new Date().toISOString();

  const updatedActions = [...(existing.actions ?? [])];
  if (body.status && body.status !== existing.status) {
    updatedActions.push({
      actionId: randomUUID(),
      type: "status_changed",
      description: `Status changed from ${existing.status} to ${body.status} by ${actorName ?? actorId}.`,
      performedBy: actorId,
      performedByName: actorName,
      performedAt: now,
    });
  }

  const updated = btamCaseRecordSchema.parse({
    ...existing,
    status: body.status ?? existing.status,
    assignedTo: body.assignedTo !== undefined ? body.assignedTo : existing.assignedTo,
    assignedToName: body.assignedToName !== undefined ? body.assignedToName : existing.assignedToName,
    safetyPlanSummary: body.safetyPlanSummary !== undefined ? body.safetyPlanSummary : existing.safetyPlanSummary,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    closedAt:
      body.status === "closed" || body.status === "referred"
        ? (existing.closedAt ?? now)
        : existing.closedAt,
    actions: updatedActions,
    updatedAt: now,
  });

  await ddb.send(
    new PutCommand({
      TableName: btamTable(),
      Item: { pk: pk(agencyId), sk: sk(caseId), ...updated },
    }),
  );

  return updated;
}

// ─── Add Action ───────────────────────────────────────────────────────────────

export async function addBtamCaseAction(
  agencyId: string,
  caseId: string,
  body: BtamAddActionBody,
  actorId: string,
  actorName?: string,
): Promise<BtamCaseRecord | null> {
  const existing = await getBtamCase(agencyId, caseId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const newAction = {
    actionId: randomUUID(),
    type: body.type,
    description: body.description,
    performedBy: actorId,
    performedByName: actorName,
    performedAt: now,
  };

  const updated = btamCaseRecordSchema.parse({
    ...existing,
    actions: [...(existing.actions ?? []), newAction],
    safetyPlanSummary: body.safetyPlanSummary !== undefined
      ? body.safetyPlanSummary
      : existing.safetyPlanSummary,
    updatedAt: now,
  });

  await ddb.send(
    new UpdateCommand({
      TableName: btamTable(),
      Key: { pk: pk(agencyId), sk: sk(caseId) },
      UpdateExpression: "SET actions = :actions, safetyPlanSummary = :sp, updatedAt = :now",
      ExpressionAttributeValues: {
        ":actions": updated.actions,
        ":sp": updated.safetyPlanSummary ?? null,
        ":now": now,
      },
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  return updated;
}
