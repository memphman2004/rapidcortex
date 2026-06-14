import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { TriageQueueItem, TriageQueueStatus } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../env.js";

function tableName(): string {
  const t = env.nonEmergencyQueueTable;
  if (!t) throw new Error("NON_EMERGENCY_QUEUE_TABLE_NOT_CONFIGURED");
  return t;
}

export async function enqueueQueueItem(
  item: Omit<TriageQueueItem, "status">,
): Promise<void> {
  const record: TriageQueueItem = { ...item, status: "PENDING" };
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: record,
      ConditionExpression: "attribute_not_exists(agencyId)",
    }),
  );
}

export async function getActiveQueue(agencyId: string): Promise<TriageQueueItem[]> {
  const results: TriageQueueItem[] = [];

  for (const status of ["PENDING", "IN_PROGRESS"] as TriageQueueStatus[]) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "StatusIndex",
        KeyConditionExpression: "agencyId = :a AND #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":a": agencyId, ":s": status },
        ScanIndexForward: true,
        Limit: 100,
      }),
    );
    results.push(...((res.Items ?? []) as TriageQueueItem[]));
  }

  return results;
}

export async function getQueueItemByIncident(
  agencyId: string,
  incidentId: string,
): Promise<TriageQueueItem | null> {
  const all = await getActiveQueue(agencyId);
  return all.find((i) => i.incidentId === incidentId) ?? null;
}

export async function getQueueItemByKey(
  agencyId: string,
  sk: string,
): Promise<TriageQueueItem | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { agencyId, sk },
    }),
  );
  return (res.Item as TriageQueueItem | undefined) ?? null;
}

export type QueueItemPatch = {
  status?: TriageQueueStatus;
  assignedTo?: string | null;
  closureNotes?: string;
  closedAt?: string;
  closedBy?: string;
  overrideBy?: string;
  overrideAt?: string;
  overrideReason?: string;
};

export async function patchQueueItem(
  agencyId: string,
  sk: string,
  patch: QueueItemPatch,
): Promise<void> {
  const setParts: string[] = [];
  const removeParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (patch.status !== undefined) {
    setParts.push("#status = :status");
    names["#status"] = "status";
    values[":status"] = patch.status;
  }
  if (patch.assignedTo !== undefined) {
    if (patch.assignedTo === null) {
      removeParts.push("assignedTo", "assignedAt");
    } else {
      setParts.push("assignedTo = :assignedTo", "assignedAt = :assignedAt");
      values[":assignedTo"] = patch.assignedTo;
      values[":assignedAt"] = new Date().toISOString();
    }
  }
  if (patch.closureNotes) {
    setParts.push("closureNotes = :cn");
    values[":cn"] = patch.closureNotes;
  }
  if (patch.closedAt) {
    setParts.push("closedAt = :cat");
    values[":cat"] = patch.closedAt;
  }
  if (patch.closedBy) {
    setParts.push("closedBy = :cby");
    values[":cby"] = patch.closedBy;
  }
  if (patch.overrideBy) {
    setParts.push("overrideBy = :oby");
    values[":oby"] = patch.overrideBy;
  }
  if (patch.overrideAt) {
    setParts.push("overrideAt = :oat");
    values[":oat"] = patch.overrideAt;
  }
  if (patch.overrideReason) {
    setParts.push("overrideReason = :or");
    values[":or"] = patch.overrideReason;
  }

  if (setParts.length === 0 && removeParts.length === 0) return;

  let expr = "";
  if (setParts.length) expr += `SET ${setParts.join(", ")} `;
  if (removeParts.length) expr += `REMOVE ${removeParts.join(", ")}`;

  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { agencyId, sk },
      UpdateExpression: expr.trim(),
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
    }),
  );
}
