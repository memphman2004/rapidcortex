import {
  normalizePipelineStage,
  type LeadActivityType,
  type PatchSalesLeadCrmBody,
  type PipelineStage,
  type SalesLeadCrmRecord,
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

/**
 * Map any legacy stage token (e.g. "PILOT") back to its current canonical value
 * ("DEMO_COMPLETED") so the board always places cards in the correct column.
 * The Lambda bundle may still return legacy tokens until a clean SAM deploy lands.
 */
function normalizeLead(lead: SalesLeadCrmRecord): SalesLeadCrmRecord {
  const stage = normalizePipelineStage(lead.pipelineStage);
  return stage === lead.pipelineStage ? lead : { ...lead, pipelineStage: stage };
}

function unwrapLead(body: ApiEnvelope<SalesLeadCrmRecord>): SalesLeadCrmRecord {
  const lead = body.data ?? body.item;
  if (!lead) throw new Error("Missing lead in response");
  return normalizeLead(lead);
}

/** Unwrap `{ success, data }` or a bare `{ stages, metrics }` payload.
 *
 * Also normalizes legacy stage bucket keys and individual lead `pipelineStage`
 * values so that e.g. a "PILOT" bucket (returned by the stale Lambda bundle)
 * is merged transparently into "DEMO_COMPLETED". Remove once a clean SAM deploy
 * ships the updated shared schema to the Lambda.
 */
export function unwrapPipelinePayload(body: unknown): PipelineData | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const inner =
    rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : rec;
  const stages = inner.stages;
  const metrics = inner.metrics;
  if (!stages || typeof stages !== "object") return null;

  // Normalize legacy stage keys (e.g. PILOT → DEMO_COMPLETED) and each lead's
  // pipelineStage field so board columns always receive canonical values.
  const normalized: Partial<Record<PipelineStage, SalesLeadCrmRecord[]>> = {};
  for (const [rawKey, bucket] of Object.entries(stages as Record<string, unknown>)) {
    const key = normalizePipelineStage(rawKey);
    if (!normalized[key]) normalized[key] = [];
    for (const lead of bucket as SalesLeadCrmRecord[]) {
      normalized[key]!.push(normalizeLead(lead));
    }
  }

  return { stages: normalized, metrics } as PipelineData;
}

export function flattenPipelineLeads(body: unknown): SalesLeadCrmRecord[] {
  const payload = unwrapPipelinePayload(body);
  if (payload) {
    return Object.values(payload.stages).flatMap((x) => x);
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const inner =
    rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : rec;
  if (Array.isArray(inner.leads)) return inner.leads as SalesLeadCrmRecord[];
  return [];
}

export async function getPipelineData(): Promise<PipelineData> {
  const res = await fetch(`${BASE}/pipeline`, { credentials: "include" });
  const body = await parseJson<unknown>(res);
  const data = unwrapPipelinePayload(body);
  if (!data) throw new Error("Missing pipeline data");
  return data;
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

export async function deleteLead(leadId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(leadId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson<ApiEnvelope<{ leadId: string; deleted: boolean }>>(res);
}

export async function getAttributionSummary(): Promise<AttributionSummary> {
  const res = await fetch(`${BASE}/attribution-summary`, { credentials: "include" });
  const body = await parseJson<ApiEnvelope<AttributionSummary>>(res);
  if (!body.data) throw new Error("Missing attribution summary");
  return body.data;
}
