import type {
  LeadActivityType,
  PatchSalesLeadCrmBody,
  PipelineStage,
  SalesLeadCrmRecord,
} from "rapid-cortex-shared";

const BASE = "/api/rc-admin/leads";

export type PipelineMetrics = {
  total: number;
  totalPipelineValue: number;
  activeDeals: number;
  winRate: number;
  avgDaysToClose: number | null;
  byStage: Record<PipelineStage, number>;
};

export type PipelineData = {
  stages: Record<PipelineStage, SalesLeadCrmRecord[]>;
  metrics: PipelineMetrics;
};

export type AttributionSummary = {
  byChannel: Record<string, { count: number; label: string; icon: string }>;
  topReferrers: { domain: string; count: number }[];
  byDevice: { mobile: number; desktop: number; tablet: number };
  byState: Record<string, number>;
};

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

function unwrapLead(body: ApiEnvelope<SalesLeadCrmRecord>): SalesLeadCrmRecord {
  const lead = body.data ?? body.item;
  if (!lead) throw new Error("Missing lead in response");
  return lead;
}

export async function getPipelineData(): Promise<PipelineData> {
  const res = await fetch(`${BASE}/pipeline`, { credentials: "include" });
  const body = await parseJson<ApiEnvelope<PipelineData>>(res);
  if (!body.data) throw new Error("Missing pipeline data");
  return body.data;
}

export async function updateLead(
  leadId: string,
  fields: PatchSalesLeadCrmBody,
): Promise<SalesLeadCrmRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(leadId)}/fields`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const body = await parseJson<ApiEnvelope<SalesLeadCrmRecord>>(res);
  return unwrapLead(body);
}

export async function updateLeadStage(
  leadId: string,
  stage: PipelineStage,
  note?: string,
  lostReason?: string,
  pilotStartDate?: string,
): Promise<SalesLeadCrmRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(leadId)}/stage`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stage,
      ...(note?.trim() ? { note: note.trim() } : {}),
      ...(lostReason?.trim() ? { lostReason: lostReason.trim() } : {}),
      ...(pilotStartDate?.trim() ? { pilotStartDate: pilotStartDate.trim() } : {}),
    }),
  });
  const body = await parseJson<ApiEnvelope<SalesLeadCrmRecord>>(res);
  return unwrapLead(body);
}

export async function addNote(
  leadId: string,
  text: string,
  pinned?: boolean,
): Promise<SalesLeadCrmRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(leadId)}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...(pinned ? { pinned: true } : {}) }),
  });
  const body = await parseJson<ApiEnvelope<SalesLeadCrmRecord>>(res);
  return unwrapLead(body);
}

export async function addActivity(
  leadId: string,
  type: Extract<LeadActivityType, "call_logged" | "email_logged" | "task_added" | "note_added">,
  description: string,
  metadata?: Record<string, string>,
): Promise<SalesLeadCrmRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(leadId)}/activities`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      description,
      ...(metadata ? { metadata } : {}),
    }),
  });
  const body = await parseJson<ApiEnvelope<SalesLeadCrmRecord>>(res);
  return unwrapLead(body);
}

export async function getAttributionSummary(): Promise<AttributionSummary> {
  const res = await fetch(`${BASE}/attribution-summary`, { credentials: "include" });
  const body = await parseJson<ApiEnvelope<AttributionSummary>>(res);
  if (!body.data) throw new Error("Missing attribution summary");
  return body.data;
}
