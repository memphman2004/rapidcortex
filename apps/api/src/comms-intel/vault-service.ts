import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import {
  normalizeAddress,
  type UserContext,
  type VaultIngestionJob,
  type VaultUploadUrlBody,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import {
  agencyPk,
  jobSk,
  locationSk,
  vaultIncidentsTable,
  vaultIngestBucket,
  vaultIngestionJobsTable,
  vaultLocationIndexTable,
} from "./tables.js";

const s3 = new S3Client({});

export async function createVaultUploadUrl(
  user: UserContext,
  body: VaultUploadUrlBody,
): Promise<{ uploadUrl: string; jobId: string; s3Key: string }> {
  const bucket = vaultIngestBucket();
  const jobsTable = vaultIngestionJobsTable();
  if (!bucket || !jobsTable) throw new Error("Vault storage not configured");

  const agencyId = user.agencyId!.trim();
  const jobId = randomUUID();
  const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const s3Key = `AGENCY#${agencyId}/jobs/${jobId}/${safeName}`;
  const now = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: jobsTable,
      Item: {
        pk: agencyPk(agencyId),
        sk: jobSk(jobId),
        jobId,
        agencyId,
        status: "pending",
        sourceSystem: body.sourceSystem,
        fileName: body.fileName,
        s3Key,
        submittedBy: user.userId,
        createdAt: now,
        completedAt: null,
        recordCount: 0,
        errorCount: 0,
      },
    }),
  );

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: body.contentType || "text/csv",
    }),
    { expiresIn: 900 },
  );

  return { uploadUrl, jobId, s3Key };
}

export async function listVaultJobs(user: UserContext): Promise<VaultIngestionJob[]> {
  const table = vaultIngestionJobsTable();
  if (!table) return [];
  const agencyId = user.agencyId!.trim();
  const res = await ddb.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(agencyId),
        ":sk": "JOB#",
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return (res.Items ?? []).map(mapJob);
}

export async function getVaultJob(user: UserContext, jobId: string): Promise<VaultIngestionJob | null> {
  const table = vaultIngestionJobsTable();
  if (!table) return null;
  const agencyId = user.agencyId!.trim();
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: agencyPk(agencyId), sk: jobSk(jobId) },
    }),
  );
  return res.Item ? mapJob(res.Item) : null;
}

export async function deleteVaultJob(user: UserContext, jobId: string): Promise<void> {
  const jobsTable = vaultIngestionJobsTable();
  const incidentsTable = vaultIncidentsTable();
  if (!jobsTable) throw new Error("Vault jobs table not configured");
  const agencyId = user.agencyId!.trim();

  // Delete incidents for this job (sk prefix INC# includes date; we store jobId on items)
  if (incidentsTable) {
    let cursor: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: incidentsTable,
          KeyConditionExpression: "pk = :pk",
          FilterExpression: "jobId = :j",
          ExpressionAttributeValues: {
            ":pk": agencyPk(agencyId),
            ":j": jobId,
          },
          ExclusiveStartKey: cursor,
          Limit: 25,
        }),
      );
      const items = res.Items ?? [];
      if (items.length) {
        await ddb.send(
          new BatchWriteCommand({
            RequestItems: {
              [incidentsTable]: items.map((it) => ({
                DeleteRequest: { Key: { pk: it.pk, sk: it.sk } },
              })),
            },
          }),
        );
      }
      cursor = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (cursor);
  }

  await ddb.send(
    new DeleteCommand({
      TableName: jobsTable,
      Key: { pk: agencyPk(agencyId), sk: jobSk(jobId) },
    }),
  );
}

export async function searchVault(
  user: UserContext,
  opts: { addr?: string; q?: string; type?: string; from?: string; to?: string; limit?: number },
) {
  const table = vaultIncidentsTable();
  if (!table) return { items: [], nextCursor: null as string | null };
  const agencyId = user.agencyId!.trim();
  const limit = opts.limit ?? 25;

  if (opts.addr) {
    const normalized = normalizeAddress(opts.addr);
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: "ByAddress",
        KeyConditionExpression: "gsi1pk = :g",
        ExpressionAttributeValues: {
          ":g": `ADDR#${normalized}`,
        },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    let items = res.Items ?? [];
    // Enforce agency boundary on GSI hits
    items = items.filter((it) => it.agencyId === agencyId || it.pk === agencyPk(agencyId));
    if (opts.type) items = items.filter((it) => String(it.callType ?? "") === opts.type);
    if (opts.q) {
      const q = opts.q.toLowerCase();
      items = items.filter((it) => String(it.narrative ?? "").toLowerCase().includes(q));
    }
    return { items, nextCursor: null };
  }

  const res = await ddb.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": agencyPk(agencyId),
        ":sk": "INC#",
      },
      Limit: limit,
      ScanIndexForward: false,
    }),
  );
  let items = res.Items ?? [];
  if (opts.type) items = items.filter((it) => String(it.callType ?? "") === opts.type);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter((it) => String(it.narrative ?? "").toLowerCase().includes(q));
  }
  if (opts.from) items = items.filter((it) => String(it.callDate ?? "") >= opts.from!);
  if (opts.to) items = items.filter((it) => String(it.callDate ?? "") <= opts.to!);
  return { items, nextCursor: null };
}

export async function getVaultLocationSummary(user: UserContext, normalizedAddr: string) {
  const table = vaultLocationIndexTable();
  if (!table) return null;
  const agencyId = user.agencyId!.trim();
  const normalized = normalizeAddress(normalizedAddr);
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: agencyPk(agencyId), sk: locationSk(normalized) },
    }),
  );
  return res.Item ?? null;
}

function mapJob(item: Record<string, unknown>): VaultIngestionJob {
  return {
    jobId: String(item.jobId),
    agencyId: String(item.agencyId),
    status: item.status as VaultIngestionJob["status"],
    sourceSystem: String(item.sourceSystem ?? "generic"),
    fileName: item.fileName ? String(item.fileName) : undefined,
    recordCount: Number(item.recordCount ?? 0),
    errorCount: Number(item.errorCount ?? 0),
    errorSummary: (item.errorSummary as Record<string, number>) ?? undefined,
    dateRangeStart: (item.dateRangeStart as string | null) ?? null,
    dateRangeEnd: (item.dateRangeEnd as string | null) ?? null,
    submittedBy: item.submittedBy ? String(item.submittedBy) : undefined,
    createdAt: String(item.createdAt ?? ""),
    completedAt: (item.completedAt as string | null) ?? null,
  };
}

export async function fetchVaultObjectText(bucket: string, key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return (await res.Body?.transformToString("utf-8")) ?? "";
}
