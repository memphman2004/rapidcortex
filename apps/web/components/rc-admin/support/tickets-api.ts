import type {
  AddSupportTicketNoteBody,
  PatchSupportTicketBody,
  SupportTicketRecord,
  TicketBoardData,
  TicketStatus,
} from "rapid-cortex-shared";

const BASE = "/api/rc-internal/support-tickets";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  item?: T;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

function unwrapTicket(body: ApiEnvelope<SupportTicketRecord>): SupportTicketRecord {
  const ticket = body.data ?? body.item;
  if (!ticket) throw new Error("Missing ticket in response");
  return ticket;
}

export async function getTicketBoard(): Promise<TicketBoardData> {
  const res = await fetch(`${BASE}/board`, { credentials: "include" });
  const body = await parseJson<ApiEnvelope<TicketBoardData>>(res);
  if (!body.data) throw new Error("Missing ticket board data");
  return body.data;
}

export async function updateTicket(
  ticketId: string,
  fields: PatchSupportTicketBody,
): Promise<SupportTicketRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const body = await parseJson<ApiEnvelope<SupportTicketRecord>>(res);
  return unwrapTicket(body);
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  extras?: { note?: string; resolutionNotes?: string; reopenReason?: string },
): Promise<SupportTicketRecord> {
  return updateTicket(ticketId, {
    status,
    ...(extras?.note?.trim() ? { note: extras.note.trim() } : {}),
    ...(extras?.resolutionNotes?.trim() ? { resolutionNotes: extras.resolutionNotes.trim() } : {}),
    ...(extras?.reopenReason?.trim() ? { reopenReason: extras.reopenReason.trim() } : {}),
  });
}

export async function addTicketNote(ticketId: string, text: string): Promise<SupportTicketRecord> {
  const body: AddSupportTicketNoteBody = { text };
  const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<ApiEnvelope<SupportTicketRecord>>(res);
  return unwrapTicket(parsed);
}
