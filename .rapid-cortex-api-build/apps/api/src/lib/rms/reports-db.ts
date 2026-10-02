import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { IncidentReport, RmsContext } from "rapid-cortex-shared";

const client = new DynamoDBClient({});

function tableName(): string {
  const name = process.env.INCIDENT_REPORTS_TABLE?.trim();
  if (!name) throw new Error("INCIDENT_REPORTS_TABLE is not configured");
  return name;
}

function pk(agencyId: string) {
  return `AGENCY#${agencyId}`;
}
function sk(reportId: string) {
  return `REPORT#${reportId}`;
}
function gsi1sk(date: string, id: string) {
  return `${date}#${id}`;
}

function stripKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g1s, ttl: _ttl, ...rest } = obj;
  void _pk;
  void _sk;
  void _g1;
  void _g1s;
  void _ttl;
  return rest;
}

export async function saveReport(report: IncidentReport): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: tableName(),
      Item: marshall(
        {
          pk: pk(report.agencyId),
          sk: sk(report.reportId),
          gsi1pk: pk(report.agencyId),
          gsi1sk: gsi1sk(report.incidentDate, report.reportId),
          ...report,
        },
        { removeUndefinedValues: true },
      ),
    }),
  );
}

export async function getReport(
  agencyId: string,
  reportId: string,
): Promise<IncidentReport | null> {
  const res = await client.send(
    new GetItemCommand({
      TableName: tableName(),
      Key: marshall({ pk: pk(agencyId), sk: sk(reportId) }),
    }),
  );
  if (!res.Item) return null;
  return stripKeys(unmarshall(res.Item)) as IncidentReport;
}

export async function listReports(
  agencyId: string,
  status?: string,
  limit = 50,
): Promise<IncidentReport[]> {
  const res = await client.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      FilterExpression: status ? "#status = :status" : undefined,
      ExpressionAttributeNames: status ? { "#status": "status" } : undefined,
      ExpressionAttributeValues: marshall({
        ":pk": pk(agencyId),
        ":prefix": "REPORT#",
        ...(status ? { ":status": status } : {}),
      }),
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items ?? []).map((i) => stripKeys(unmarshall(i)) as IncidentReport);
}

export async function updateReport(
  agencyId: string,
  reportId: string,
  updates: Partial<IncidentReport> & { updatedBy?: string },
  updatedBy: string,
): Promise<IncidentReport> {
  const existing = await getReport(agencyId, reportId);
  if (!existing) throw new Error("Report not found");
  if (existing.status === "finalized" || existing.status === "pushed_to_rms") {
    const allowedKeys = new Set([
      "rmsPushStatus",
      "rmsPushTarget",
      "rmsPushedAt",
      "rmsExternalId",
      "status",
    ]);
    const keys = Object.keys(updates).filter((k) => k !== "updatedBy");
    if (keys.some((k) => !allowedKeys.has(k))) {
      throw new Error("Finalized reports cannot be edited");
    }
  }

  const now = new Date().toISOString();
  const { reportId: _id, agencyId: _aid, createdAt: _ca, createdBy: _cb, ...safeUpdates } =
    updates;
  void _id;
  void _aid;
  void _ca;
  void _cb;

  const setExpressions: string[] = ["updatedAt = :now"];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":now": now, ":by": updatedBy };

  setExpressions.push("updatedBy = :by");

  for (const [key, val] of Object.entries(safeUpdates)) {
    if (val === undefined || key === "updatedBy") continue;
    const alias = `#${key}`;
    names[alias] = key;
    values[`:${key}`] = val;
    setExpressions.push(`${alias} = :${key}`);
  }

  await client.send(
    new UpdateItemCommand({
      TableName: tableName(),
      Key: marshall({ pk: pk(agencyId), sk: sk(reportId) }),
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_exists(pk)",
    }),
  );

  const next = await getReport(agencyId, reportId);
  if (!next) throw new Error("Report not found after update");
  return next;
}

export async function finalizeReport(
  agencyId: string,
  reportId: string,
  finalizedBy: string,
): Promise<IncidentReport> {
  return updateReport(
    agencyId,
    reportId,
    {
      status: "finalized",
      finalizedBy,
      finalizedAt: new Date().toISOString(),
      nibrsConfirmed: true,
    },
    finalizedBy,
  );
}

const CACHE_TTL_SECONDS = 3600;

export async function getRmsContextCache(key: string): Promise<RmsContext | null> {
  try {
    const res = await client.send(
      new GetItemCommand({
        TableName: tableName(),
        Key: marshall({ pk: `RMSCACHE#${key}`, sk: "META" }),
      }),
    );
    if (!res.Item) return null;
    const item = unmarshall(res.Item);
    if (typeof item.ttl === "number" && Date.now() / 1000 > item.ttl) return null;
    return item.data as RmsContext;
  } catch {
    return null;
  }
}

export async function setRmsContextCache(key: string, data: RmsContext): Promise<void> {
  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName(),
        Item: marshall(
          {
            pk: `RMSCACHE#${key}`,
            sk: "META",
            data,
            ttl: Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS,
          },
          { removeUndefinedValues: true },
        ),
      }),
    );
  } catch {
    /* cache write is best-effort */
  }
}
