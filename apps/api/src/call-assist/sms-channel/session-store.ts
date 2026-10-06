import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { normalizeCallAssistDid } from "../lex/runtime-store.js";
import type { SmsSessionRecord } from "./types.js";

const SESSION_IDLE_TTL_SECONDS = 4 * 60 * 60;
const OPT_OUT_TTL_SECONDS = 365 * 24 * 60 * 60;

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }),
  { marshallOptions: { removeUndefinedValues: true } },
);

function tableName(): string {
  const t = process.env.CALL_ASSIST_TABLE?.trim();
  if (!t) throw new Error("CALL_ASSIST_TABLE is not configured");
  return t;
}

function last4(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return digits.slice(-4) || "****";
}

function smsSk(phoneE164: string): string {
  return `SMS#${normalizeCallAssistDid(phoneE164)}`;
}

function idleTtl(): number {
  return Math.floor(Date.now() / 1000) + SESSION_IDLE_TTL_SECONDS;
}

export async function getSmsSession(agencyId: string, phoneE164: string): Promise<SmsSessionRecord | null> {
  if (!agencyId) return null;
  const out = await doc.send(
    new GetCommand({
      TableName: tableName(),
      Key: { agencyId, sk: smsSk(phoneE164) },
    }),
  );
  const item = out.Item as SmsSessionRecord | undefined;
  if (!item || item.agencyId !== agencyId) return null;
  return item;
}

export async function isNewCaller(agencyId: string, phoneE164: string): Promise<boolean> {
  return (await getSmsSession(agencyId, phoneE164)) === null;
}

/** True until the SMS welcome has been delivered (includes brand-new callers). */
export async function needsWelcome(agencyId: string, phoneE164: string): Promise<boolean> {
  const session = await getSmsSession(agencyId, phoneE164);
  if (!session || session.optedOut) return true;
  return session.welcomeSent !== true;
}

export async function isOptedOut(agencyId: string, phoneE164: string): Promise<boolean> {
  const session = await getSmsSession(agencyId, phoneE164);
  return session?.optedOut === true;
}

export async function isSessionIdle(agencyId: string, phoneE164: string): Promise<boolean> {
  const session = await getSmsSession(agencyId, phoneE164);
  if (!session || session.optedOut) return false;
  return Math.floor(Date.now() / 1000) - session.lastActivity > SESSION_IDLE_TTL_SECONDS;
}

export async function touchSession(
  agencyId: string,
  phoneE164: string,
  lastConfirmationNumber?: string,
  opts?: { welcomeSent?: boolean },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await getSmsSession(agencyId, phoneE164);
  const next: SmsSessionRecord = {
    agencyId,
    sk: smsSk(phoneE164),
    entityType: "call_assist_sms_session",
    phoneLast4: last4(phoneE164),
    lastActivity: now,
    optedOut: existing?.optedOut === true,
    optedOutAt: existing?.optedOutAt,
    firstSeen: existing?.firstSeen ?? new Date().toISOString(),
    messageCount: (existing?.messageCount ?? 0) + 1,
    welcomeSent: opts?.welcomeSent === true ? true : existing?.welcomeSent === true,
    lastConfirmationNumber: lastConfirmationNumber ?? existing?.lastConfirmationNumber,
    expiresAt: existing?.optedOut ? existing.expiresAt : idleTtl(),
  };
  await doc.send(new PutCommand({ TableName: tableName(), Item: next }));
}

export async function recordOptOut(agencyId: string, phoneE164: string): Promise<void> {
  const existing = await getSmsSession(agencyId, phoneE164);
  const now = Math.floor(Date.now() / 1000);
  await doc.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        agencyId,
        sk: smsSk(phoneE164),
        entityType: "call_assist_sms_session",
        phoneLast4: last4(phoneE164),
        lastActivity: now,
        optedOut: true,
        optedOutAt: new Date().toISOString(),
        firstSeen: existing?.firstSeen ?? new Date().toISOString(),
        messageCount: existing?.messageCount ?? 0,
        lastConfirmationNumber: existing?.lastConfirmationNumber,
        expiresAt: now + OPT_OUT_TTL_SECONDS,
      } satisfies SmsSessionRecord,
    }),
  );
}

export async function recordOptIn(agencyId: string, phoneE164: string): Promise<void> {
  const existing = await getSmsSession(agencyId, phoneE164);
  const now = Math.floor(Date.now() / 1000);
  await doc.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        agencyId,
        sk: smsSk(phoneE164),
        entityType: "call_assist_sms_session",
        phoneLast4: last4(phoneE164),
        lastActivity: now,
        optedOut: false,
        firstSeen: existing?.firstSeen ?? new Date().toISOString(),
        messageCount: existing?.messageCount ?? 0,
        lastConfirmationNumber: existing?.lastConfirmationNumber,
        expiresAt: idleTtl(),
      } satisfies SmsSessionRecord,
    }),
  );
}
