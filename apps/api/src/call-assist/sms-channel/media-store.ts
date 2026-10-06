import { createHash } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { normalizeCallAssistDid } from "../lex/runtime-store.js";
import type { ProcessedSmsMedia, SmsMediaRecord } from "./types.js";

const MEDIA_TTL_DAYS = 30;

const region = process.env.AWS_REGION || "us-east-1";
const s3 = new S3Client({ region });
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

function tableName(): string {
  const t = process.env.CALL_ASSIST_TABLE?.trim();
  if (!t) throw new Error("CALL_ASSIST_TABLE is not configured");
  return t;
}

function mediaBucket(): string {
  return process.env.CALL_ASSIST_SMS_MEDIA_BUCKET?.trim() || "";
}

function last4(phoneE164: string): string {
  return phoneE164.replace(/\D/g, "").slice(-4) || "****";
}

function phoneHash(phoneE164: string): string {
  return createHash("sha256").update(normalizeCallAssistDid(phoneE164)).digest("hex").slice(0, 16);
}

function contentTypeToExtension(ct: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/3gpp": "3gp",
    "video/3gpp2": "3g2",
  };
  return map[ct.toLowerCase()] ?? "bin";
}

export function buildSmsMediaS3Key(opts: {
  agencyId: string;
  phoneE164: string;
  msgId: string;
  index: number;
  contentType: string;
}): string {
  const idx = String(opts.index + 1).padStart(3, "0");
  const ext = contentTypeToExtension(opts.contentType);
  return `sms/${opts.agencyId}/${phoneHash(opts.phoneE164)}/${opts.msgId}/${idx}.${ext}`;
}

function mediaSk(phoneE164: string, receivedAt: string, msgId: string): string {
  return `SMSMEDIA#${normalizeCallAssistDid(phoneE164)}#${receivedAt}#${msgId}`;
}

export async function uploadToS3(
  buffer: Buffer,
  opts: { agencyId: string; phoneE164: string; msgId: string; index: number; contentType: string },
): Promise<string> {
  const bucket = mediaBucket();
  if (!bucket) throw new Error("CALL_ASSIST_SMS_MEDIA_BUCKET is not configured");
  const key = buildSmsMediaS3Key(opts);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: opts.contentType,
      Metadata: {
        "x-rc-phone-last4": last4(opts.phoneE164),
        "x-rc-agency": opts.agencyId,
      },
    }),
  );
  return key;
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  const bucket = mediaBucket();
  if (!bucket) return;
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
}

export async function saveMediaRecord(
  agencyId: string,
  phoneE164: string,
  msgId: string,
  processed: ProcessedSmsMedia,
): Promise<SmsMediaRecord> {
  const now = new Date().toISOString();
  const record: SmsMediaRecord = {
    agencyId,
    sk: mediaSk(phoneE164, now, msgId),
    entityType: "call_assist_sms_media",
    phoneE164: normalizeCallAssistDid(phoneE164),
    phoneLast4: last4(phoneE164),
    msgId,
    receivedAt: now,
    s3Key: processed.s3Key,
    s3Bucket: processed.s3Bucket,
    contentType: processed.contentType,
    mediaType: processed.mediaType,
    fileSizeBytes: processed.fileSizeBytes,
    moderationPassed: processed.moderationPassed,
    moderationLabels: processed.moderationLabels,
    sceneLabels: processed.sceneLabels,
    expiresAt: Math.floor(Date.now() / 1000) + MEDIA_TTL_DAYS * 86400,
  };
  await doc.send(new PutCommand({ TableName: tableName(), Item: record }));
  return record;
}

export async function getPendingMediaForPhone(
  agencyId: string,
  phoneE164: string,
  withinMinutes = 60,
): Promise<SmsMediaRecord[]> {
  const e164 = normalizeCallAssistDid(phoneE164);
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const out = await doc.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "agencyId = :a AND begins_with(#sk, :p)",
      FilterExpression: "attribute_not_exists(confirmationNumber) AND receivedAt >= :cutoff",
      ExpressionAttributeNames: { "#sk": "sk" },
      ExpressionAttributeValues: {
        ":a": agencyId,
        ":p": `SMSMEDIA#${e164}#`,
        ":cutoff": cutoff,
      },
    }),
  );
  return ((out.Items as SmsMediaRecord[]) ?? []).filter((row) => row.agencyId === agencyId);
}

export async function claimMediaForConfirmation(
  agencyId: string,
  phoneE164: string,
  confirmationNumber: string,
  withinMinutes = 60,
): Promise<SmsMediaRecord[]> {
  const pending = await getPendingMediaForPhone(agencyId, phoneE164, withinMinutes);
  if (pending.length === 0) return [];
  await Promise.all(
    pending.map((rec) =>
      doc.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: { agencyId: rec.agencyId, sk: rec.sk },
          ConditionExpression: "agencyId = :a",
          UpdateExpression: "SET confirmationNumber = :c",
          ExpressionAttributeValues: { ":a": agencyId, ":c": confirmationNumber },
        }),
      ),
    ),
  );
  return pending.map((rec) => ({ ...rec, confirmationNumber }));
}

export async function listMediaForConfirmation(
  agencyId: string,
  confirmationNumber: string,
): Promise<SmsMediaRecord[]> {
  const out = await doc.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "agencyId = :a AND begins_with(#sk, :p)",
      FilterExpression: "confirmationNumber = :c AND agencyId = :a",
      ExpressionAttributeNames: { "#sk": "sk" },
      ExpressionAttributeValues: {
        ":a": agencyId,
        ":p": "SMSMEDIA#",
        ":c": confirmationNumber,
      },
    }),
  );
  return ((out.Items as SmsMediaRecord[]) ?? []).filter(
    (row) => row.agencyId === agencyId && row.confirmationNumber === confirmationNumber,
  );
}
