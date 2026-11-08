/**
 * Connect disconnect Lambda — closes any Lex or Nova session still OPEN.
 * Idempotent: already-closed sessions are a no-op.
 *
 * Intentionally does NOT import call-assist/store (avoids AUDIT_TABLE / heavy deps).
 * Table keys: agencyId + sk (SESSION#{id} | SESSION#nova#{contactId}).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export type DisconnectDoc = {
  send: (command: unknown) => Promise<{ Item?: Record<string, unknown> }>;
};

export type ConnectDisconnectEvent = {
  Details?: {
    Parameters?: Record<string, string>;
    ContactData?: {
      ContactId?: string;
      Attributes?: Record<string, string>;
    };
    ContactId?: string;
  };
};

function tableName(): string {
  const t = process.env.CALL_ASSIST_TABLE?.trim();
  if (!t) throw new Error("CALL_ASSIST_TABLE is required");
  return t;
}

function defaultDoc(): DisconnectDoc {
  return DynamoDBDocumentClient.from(new DynamoDBClient({})) as unknown as DisconnectDoc;
}

function novaSk(contactId: string): string {
  return `SESSION#nova#${contactId}`;
}

function isNovaOpen(status: unknown): boolean {
  return status === "PENDING" || status === "ACTIVE";
}

export function contactIdFromDisconnect(event: ConnectDisconnectEvent): string {
  return (
    event.Details?.ContactData?.ContactId?.trim() ||
    event.Details?.ContactId?.trim() ||
    event.Details?.Parameters?.contactId?.trim() ||
    ""
  );
}

export function agencyIdFromDisconnect(event: ConnectDisconnectEvent): string {
  return (
    event.Details?.Parameters?.agencyId?.trim() ||
    event.Details?.ContactData?.Attributes?.agencyId?.trim() ||
    event.Details?.Parameters?.AgencyId?.trim() ||
    "default"
  );
}

function lexStillOpen(item: Record<string, unknown>): boolean {
  if (item.completedAt) return false;
  const state = String(item.state ?? "");
  if (state === "COMPLETED" || state === "FAILED" || state === "SURVEY") return false;
  const gsi = String(item.gsi1pk ?? "");
  return gsi.endsWith("#OPEN") || !gsi;
}

async function closeLexSession(
  agencyId: string,
  contactId: string,
  doc: DisconnectDoc,
): Promise<string | null> {
  const out = await doc.send(
    new GetCommand({
      TableName: tableName(),
      Key: { agencyId, sk: `SESSION#${contactId}` },
    }),
  );
  const item = out.Item;
  if (!item || !lexStillOpen(item)) return null;

  const now = new Date().toISOString();
  const confirmation =
    String(item.caseNumber ?? "").trim() || String(item.confirmationNumber ?? "").trim();
  const disposition = confirmation ? "COMPLETED" : "ABANDONED";
  const state = confirmation ? "COMPLETED" : "FAILED";
  const sessionId = String(item.sessionId ?? contactId);
  const next = {
    ...item,
    agencyId,
    sessionId,
    sk: `SESSION#${sessionId}`,
    entityType: "call_assist_session",
    state,
    completedAt: now,
    callEndedAt: now,
    disposition,
    continueAiConversation: false,
    updatedAt: now,
    gsi1pk: `${agencyId}#DONE`,
    gsi1sk: String(item.createdAt ?? now),
  };
  await doc.send(new PutCommand({ TableName: tableName(), Item: next }));
  return disposition;
}

async function closeNovaSession(
  agencyId: string,
  contactId: string,
  doc: DisconnectDoc,
): Promise<string | null> {
  const out = await doc.send(
    new GetCommand({
      TableName: tableName(),
      Key: { agencyId, sk: novaSk(contactId) },
    }),
  );
  const item = out.Item;
  if (!item) return null;
  if (!isNovaOpen(item.status)) return null;

  const now = new Date().toISOString();
  const handoff = (item.handoff ?? {}) as { confirmationNumber?: string };
  const confirmation = String(handoff.confirmationNumber ?? "").trim();
  const disposition = confirmation ? "COMPLETED" : "ABANDONED";
  const next = {
    ...item,
    status: confirmation ? "COMPLETED" : "ERROR",
    state: confirmation ? "COMPLETED" : "FAILED",
    disposition,
    completedAt: now,
    callEndedAt: now,
    updatedAt: now,
    continueAiConversation: false,
    gsi1pk: `${agencyId}#DONE`,
    gsi1sk: String(item.createdAt ?? now),
    entityType: "call_assist_session",
  };
  await doc.send(new PutCommand({ TableName: tableName(), Item: next }));
  return disposition;
}

export async function closeOpenCallAssistSessions(
  opts: { agencyId: string; contactId: string },
  doc: DisconnectDoc = defaultDoc(),
): Promise<{ lex: string | null; nova: string | null }> {
  const { agencyId, contactId } = opts;
  if (!agencyId || !contactId) return { lex: null, nova: null };
  const lex = await closeLexSession(agencyId, contactId, doc).catch((err) => {
    console.error(
      JSON.stringify({
        msg: "call_assist_disconnect_lex_failed",
        agencyId,
        contactId,
        err: String(err),
      }),
    );
    return null;
  });
  const nova = await closeNovaSession(agencyId, contactId, doc).catch((err) => {
    console.error(
      JSON.stringify({
        msg: "call_assist_disconnect_nova_failed",
        agencyId,
        contactId,
        err: String(err),
      }),
    );
    return null;
  });
  return { lex, nova };
}

export async function buildDisconnectResult(
  event: ConnectDisconnectEvent,
  doc?: DisconnectDoc,
): Promise<Record<string, string>> {
  const contactId = contactIdFromDisconnect(event);
  const agencyId = agencyIdFromDisconnect(event);
  if (!contactId) {
    return { status: "ok", closed: "false", reason: "missing_contact" };
  }
  const result = await closeOpenCallAssistSessions({ agencyId, contactId }, doc ?? defaultDoc());
  const closed = Boolean(result.lex || result.nova);
  return {
    status: "ok",
    closed: closed ? "true" : "false",
    agencyId,
    contactId,
    lexDisposition: result.lex ?? "",
    novaDisposition: result.nova ?? "",
  };
}

export async function handler(event: ConnectDisconnectEvent): Promise<Record<string, string>> {
  return buildDisconnectResult(event);
}
