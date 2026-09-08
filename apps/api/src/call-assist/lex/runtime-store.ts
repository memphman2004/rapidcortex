/**
 * Dynamo access for Lex / Connect Lambdas.
 * Does not import apps/api env.ts (AUDIT_TABLE and other API-required vars).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { GENERIC_DISCLOSURE_TEXT, MISSOURI_SUNSHINE_RETENTION_POLICY } from "rapid-cortex-shared";
import type { CallAssistSessionRecord, CallAssistTenantConfig } from "../store.js";

export const CALL_ASSIST_DID_INDEX_PK = "__did_index__";

export function normalizeCallAssistDid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function tableName(): string {
  const t = process.env.CALL_ASSIST_TABLE?.trim();
  if (!t) throw new Error("CALL_ASSIST_TABLE is not configured");
  return t;
}

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));

export function genericLexConfig(agencyId: string): CallAssistTenantConfig {
  return {
    agencyId,
    disclosureEnabled: true,
    disclosureText: GENERIC_DISCLOSURE_TEXT,
    emergencyDestination: "911",
    demoEmergencyDestination: "+15555550111",
    cadProviderId: "mock",
    cadHumanReviewRequired: true,
    cadNatureMapping: {},
    carfaxPortalUrl: "",
    onlineReportUrl: "",
    retention: {
      ...MISSOURI_SUNSHINE_RETENTION_POLICY,
      policyId: "generic-default",
      jurisdiction: "US",
      statute: undefined,
      displayName: undefined,
      policyName: undefined,
      governingLaw: null,
    },
    operatingHours: { timezone: "UTC", openMinutes: 0, closeMinutes: 24 * 60, allDay: true },
    videoAssistEnabled: true,
    emergencyLine: "911",
    defaultLanguageCode: "en-US",
    supportedLanguages: ["en-US"],
    updatedAt: new Date().toISOString(),
  };
}

export async function getLexTenantConfig(agencyId: string): Promise<CallAssistTenantConfig> {
  if (!agencyId) return genericLexConfig("unknown");
  const out = await doc.send(
    new GetCommand({ TableName: tableName(), Key: { agencyId, sk: "CONFIG#tenant" } }),
  );
  return (out.Item as CallAssistTenantConfig | undefined) ?? genericLexConfig(agencyId);
}

export async function getLexSession(agencyId: string, callId: string): Promise<CallAssistSessionRecord | null> {
  if (!agencyId || !callId) return null;
  const out = await doc.send(
    new GetCommand({ TableName: tableName(), Key: { agencyId, sk: `SESSION#${callId}` } }),
  );
  return (out.Item as CallAssistSessionRecord | undefined) ?? null;
}

export async function putLexSession(session: CallAssistSessionRecord): Promise<void> {
  const open = !session.completedAt && session.state !== "COMPLETED" && session.state !== "FAILED";
  await doc.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        ...session,
        sk: `SESSION#${session.sessionId}`,
        entityType: "call_assist_session",
        gsi1pk: `${session.agencyId}#${open ? "OPEN" : "DONE"}`,
        gsi1sk: session.createdAt,
      },
    }),
  );
}

export async function updateLexSession(
  agencyId: string,
  callId: string,
  updates: Partial<CallAssistSessionRecord> & Record<string, unknown>,
): Promise<void> {
  const existing = await getLexSession(agencyId, callId);
  if (!existing) return;
  const { state, ...rest } = updates;
  await putLexSession({
    ...existing,
    ...rest,
    ...(state ? { state } : {}),
    agencyId,
    sessionId: callId,
    updatedAt: new Date().toISOString(),
  });
}

export async function getAgencyIdByDid(phoneNumber: string): Promise<string | null> {
  const e164 = normalizeCallAssistDid(phoneNumber);
  if (!e164) return null;
  const out = await doc.send(
    new GetCommand({
      TableName: tableName(),
      Key: { agencyId: CALL_ASSIST_DID_INDEX_PK, sk: `PHONE#${e164}` },
    }),
  );
  const row = out.Item as { targetAgencyId?: string } | undefined;
  return row?.targetAgencyId?.trim() || null;
}
