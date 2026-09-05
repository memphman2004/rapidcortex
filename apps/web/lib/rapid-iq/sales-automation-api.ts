import type {
  CreateRapidIqSalesSequenceBody,
  RapidIqSalesCampaignCard,
  RapidIqSalesContentDraft,
  RapidIqSalesMetrics,
  RapidIqSalesSequence,
} from "rapid-cortex-shared";

const BASE = "/api/rapid-iq/sales-automation";

export const SALES_AUTOMATION_SEQUENCES_QUERY_KEY = ["rapid-iq-sales-sequences"] as const;
export const SALES_AUTOMATION_DRAFTS_QUERY_KEY = ["rapid-iq-sales-drafts"] as const;
export const SALES_AUTOMATION_CAMPAIGNS_QUERY_KEY = ["rapid-iq-sales-campaigns"] as const;
export const SALES_AUTOMATION_METRICS_QUERY_KEY = ["rapid-iq-sales-metrics"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function listSalesSequences(): Promise<RapidIqSalesSequence[]> {
  const res = await fetch(`${BASE}/sequences`, { credentials: "include" });
  const body = await parseJson<{ sequences: RapidIqSalesSequence[] }>(res);
  return body.sequences ?? [];
}

export async function listSalesDrafts(): Promise<RapidIqSalesContentDraft[]> {
  const res = await fetch(`${BASE}/drafts`, { credentials: "include" });
  const body = await parseJson<{ drafts: RapidIqSalesContentDraft[] }>(res);
  return body.drafts ?? [];
}

export async function listSalesCampaigns(): Promise<RapidIqSalesCampaignCard[]> {
  const res = await fetch(`${BASE}/campaigns`, { credentials: "include" });
  const body = await parseJson<{ campaigns: RapidIqSalesCampaignCard[] }>(res);
  return body.campaigns ?? [];
}

export async function getSalesMetrics(): Promise<RapidIqSalesMetrics> {
  const res = await fetch(`${BASE}/metrics`, { credentials: "include" });
  const body = await parseJson<{ metrics: RapidIqSalesMetrics }>(res);
  return body.metrics;
}

export async function approveSalesSequence(sequenceId: string): Promise<RapidIqSalesSequence> {
  const res = await fetch(`${BASE}/sequences/${encodeURIComponent(sequenceId)}/approve`, {
    method: "POST",
    credentials: "include",
  });
  const body = await parseJson<{ sequence: RapidIqSalesSequence }>(res);
  return body.sequence;
}

export async function suppressSalesSequence(sequenceId: string): Promise<RapidIqSalesSequence> {
  const res = await fetch(`${BASE}/sequences/${encodeURIComponent(sequenceId)}/suppress`, {
    method: "POST",
    credentials: "include",
  });
  const body = await parseJson<{ sequence: RapidIqSalesSequence }>(res);
  return body.sequence;
}

export async function approveSalesDraft(draftId: string): Promise<RapidIqSalesContentDraft> {
  const res = await fetch(`${BASE}/drafts/${encodeURIComponent(draftId)}/approve`, {
    method: "POST",
    credentials: "include",
  });
  const body = await parseJson<{ draft: RapidIqSalesContentDraft }>(res);
  return body.draft;
}

export async function createSalesSequence(
  body: CreateRapidIqSalesSequenceBody,
): Promise<RapidIqSalesSequence> {
  const res = await fetch(`${BASE}/sequences`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ sequence: RapidIqSalesSequence }>(res);
  return parsed.sequence;
}
