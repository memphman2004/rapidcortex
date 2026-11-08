/**
 * Dynamo session rows for Nova Sonic Connect calls: SESSION#nova#{contactId}
 * Must participate in Live GSI (`gsi1pk = {agencyId}#OPEN|DONE`) so the dashboard sees them.
 */
import type { NovaSonicConnectHandoffAttrs } from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "../store.js";
import type { NovaSonicIntakeState } from "./tools.js";

export type NovaSonicSessionStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "EMERGENCY"
  | "FALLBACK"
  | "HUMAN"
  | "ERROR";

export type NovaSonicDisposition = "COMPLETED" | "TRANSFERRED" | "ABANDONED" | "ERROR";

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
  /** Lex-compatible monitor state for Live / Records UI. */
  state?: string;
  intake: NovaSonicIntakeState;
  handoff: NovaSonicConnectHandoffAttrs;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  callEndedAt?: string;
  disposition?: NovaSonicDisposition;
  expiresAt?: number;
  gsi1pk?: string;
  gsi1sk?: string;
  entityType?: string;
  mode?: string;
  source?: string;
  language?: string;
  ttyMode?: boolean;
  disclosureDelivered?: boolean;
  continueAiConversation?: boolean;
  legalHold?: boolean;
  utterances?: Array<{ sequence: number; speaker: string; text: string; at: string }>;
  connectContactId?: string;
};

export function novaSonicSessionId(contactId: string): string {
  return `nova#${contactId}`;
}

export function novaSonicSessionSk(contactId: string): string {
  return `SESSION#${novaSonicSessionId(contactId)}`;
}

export function isNovaSessionOpen(status: NovaSonicSessionStatus): boolean {
  return status === "PENDING" || status === "ACTIVE";
}

/** Map Nova stream status → Call Assist monitor `state` + disposition for Records. */
export function novaSessionCloseFields(status: NovaSonicSessionStatus): {
  state: string;
  disposition: NovaSonicDisposition;
  open: boolean;
} {
  switch (status) {
    case "PENDING":
    case "ACTIVE":
      return { state: "INTAKE", disposition: "ABANDONED", open: true };
    case "EMERGENCY":
      return { state: "TRANSFERRING_911", disposition: "TRANSFERRED", open: false };
    case "HUMAN":
    case "FALLBACK":
      return { state: "TRANSFERRING_HUMAN", disposition: "TRANSFERRED", open: false };
    case "ERROR":
      return { state: "FAILED", disposition: "ERROR", open: false };
    case "COMPLETED":
    default:
      return { state: "COMPLETED", disposition: "COMPLETED", open: false };
  }
}

function withLiveGsi(row: NovaSonicSessionRow): NovaSonicSessionRow {
  const close = novaSessionCloseFields(row.status);
  const open = close.open;
  const now = row.updatedAt || new Date().toISOString();
  const createdAt = row.createdAt || now;
  return {
    ...row,
    entityType: "call_assist_session",
    mode: row.mode ?? "NON_EMERGENCY",
    source: row.source ?? "LIVE",
    language: row.language ?? "en",
    ttyMode: row.ttyMode ?? false,
    disclosureDelivered: row.disclosureDelivered ?? true,
    continueAiConversation: open,
    legalHold: row.legalHold ?? false,
    utterances: row.utterances ?? [],
    connectContactId: row.connectContactId ?? row.contactId,
    state: open ? "INTAKE" : close.state,
    disposition: open ? undefined : (row.disposition ?? close.disposition),
    completedAt: open ? undefined : (row.completedAt ?? row.callEndedAt ?? now),
    callEndedAt: open ? undefined : (row.callEndedAt ?? row.completedAt ?? now),
    gsi1pk: `${row.agencyId}#${open ? "OPEN" : "DONE"}`,
    gsi1sk: createdAt,
  };
}

export async function putNovaSonicSession(row: NovaSonicSessionRow): Promise<void> {
  const table = process.env.CALL_ASSIST_TABLE?.trim();
  if (!table) throw new Error("CALL_ASSIST_TABLE is required");
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const item = withLiveGsi(row);
  await doc.send(
    new PutCommand({
      TableName: table,
      Item: {
        ...item,
        agencyId: item.agencyId,
        sk: item.sk,
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
  patch: Partial<Pick<NovaSonicSessionRow, "status" | "intake" | "handoff" | "kvsStreamArn" | "disposition">> & {
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
  const { callAssistStore } = await import("../store.js");
  return callAssistStore.getConfig(agencyId).catch(() => null);
}
