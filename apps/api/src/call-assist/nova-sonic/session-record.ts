/**
 * Dynamo session rows for Nova Sonic Connect calls: SESSION#nova#{contactId}
 */
import { callAssistStore, type CallAssistTenantConfig } from "../store.js";
import type { NovaSonicConnectHandoffAttrs } from "rapid-cortex-shared";
import type { NovaSonicIntakeState } from "./tools.js";

export type NovaSonicSessionStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "EMERGENCY"
  | "FALLBACK"
  | "HUMAN"
  | "ERROR";

export type NovaSonicSessionRow = {
  agencyId: string;
  /** Sort key without agency — store uses SESSION# prefix via putSession-like raw put. */
  sessionId: string;
  sk: string;
  kind: "nova_sonic";
  contactId: string;
  agencyVoiceName: string;
  systemPrompt: string;
  voiceId: string;
  modelId: string;
  kvsStreamArn?: string;
  status: NovaSonicSessionStatus;
  intake: NovaSonicIntakeState;
  handoff: NovaSonicConnectHandoffAttrs;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
};

export function novaSonicSessionId(contactId: string): string {
  return `nova#${contactId}`;
}

export function novaSonicSessionSk(contactId: string): string {
  return `SESSION#${novaSonicSessionId(contactId)}`;
}

export async function putNovaSonicSession(row: NovaSonicSessionRow): Promise<void> {
  const table = process.env.CALL_ASSIST_TABLE?.trim();
  if (!table) throw new Error("CALL_ASSIST_TABLE is required");
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  await doc.send(
    new PutCommand({
      TableName: table,
      Item: {
        ...row,
        // Single-table call-assist uses agencyId + sk
        agencyId: row.agencyId,
        sk: row.sk,
      },
    }),
  );
}

export async function getNovaSonicSession(
  agencyId: string,
  contactId: string,
): Promise<NovaSonicSessionRow | null> {
  const table = process.env.CALL_ASSIST_TABLE?.trim();
  if (!table) return null;
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, GetCommand } = await import("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const out = await doc.send(
    new GetCommand({
      TableName: table,
      Key: { agencyId, sk: novaSonicSessionSk(contactId) },
    }),
  );
  return (out.Item as NovaSonicSessionRow | undefined) ?? null;
}

export async function updateNovaSonicSession(
  agencyId: string,
  contactId: string,
  patch: Partial<Pick<NovaSonicSessionRow, "status" | "intake" | "handoff" | "kvsStreamArn">> & {
    updatedAt?: string;
  },
): Promise<NovaSonicSessionRow | null> {
  const current = await getNovaSonicSession(agencyId, contactId);
  if (!current) return null;
  const next: NovaSonicSessionRow = {
    ...current,
    ...patch,
    intake: { ...current.intake, ...(patch.intake ?? {}) },
    handoff: { ...current.handoff, ...(patch.handoff ?? {}) },
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
  await putNovaSonicSession(next);
  return next;
}

export async function loadTenantForNova(agencyId: string): Promise<CallAssistTenantConfig | null> {
  return callAssistStore.getConfig(agencyId).catch(() => null);
}
