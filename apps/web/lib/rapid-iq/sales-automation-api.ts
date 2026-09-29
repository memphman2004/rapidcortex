import type {
  CreateNexiQSalesBulkCampaignBody,
  CreateNexiQSalesSequenceBody,
  NexiQOutlookStatus,
  NexiQSalesBulkApproveResult,
  NexiQSalesBulkBatch,
  NexiQSalesBulkResult,
  NexiQSalesCampaignCard,
  NexiQSalesContentDraft,
  NexiQSalesMetrics,
  NexiQSalesSequence,
  UpdateNexiQSalesDraftBody,
  UpdateNexiQSalesSequenceBody,
} from "rapid-cortex-shared";

const BASE = "/api/rapid-iq/sales-automation";

export const SALES_AUTOMATION_SEQUENCES_QUERY_KEY = ["rapid-iq-sales-sequences"] as const;
export const SALES_AUTOMATION_DRAFTS_QUERY_KEY = ["rapid-iq-sales-drafts"] as const;
export const SALES_AUTOMATION_CAMPAIGNS_QUERY_KEY = ["rapid-iq-sales-campaigns"] as const;
export const SALES_AUTOMATION_METRICS_QUERY_KEY = ["rapid-iq-sales-metrics"] as const;
export const SALES_AUTOMATION_OUTLOOK_QUERY_KEY = ["rapid-iq-sales-outlook"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function listSalesSequences(): Promise<NexiQSalesSequence[]> {
  const res = await fetch(`${BASE}/sequences`, { credentials: "include" });
  const body = await parseJson<{ sequences: NexiQSalesSequence[] }>(res);
  return body.sequences ?? [];
}

export async function listSalesDrafts(): Promise<NexiQSalesContentDraft[]> {
  const res = await fetch(`${BASE}/drafts`, { credentials: "include" });
  const body = await parseJson<{ drafts: NexiQSalesContentDraft[] }>(res);
  return body.drafts ?? [];
}

export async function listSalesCampaigns(): Promise<{
  campaigns: NexiQSalesCampaignCard[];
  batches: NexiQSalesBulkBatch[];
}> {
  const res = await fetch(`${BASE}/campaigns`, { credentials: "include" });
  const body = await parseJson<{
    campaigns: NexiQSalesCampaignCard[];
    batches?: NexiQSalesBulkBatch[];
  }>(res);
  return { campaigns: body.campaigns ?? [], batches: body.batches ?? [] };
}

export async function createSalesBulkCampaign(
  body: CreateNexiQSalesBulkCampaignBody,
): Promise<NexiQSalesBulkResult> {
  const res = await fetch(`${BASE}/bulk`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ result: NexiQSalesBulkResult }>(res);
  return parsed.result;
}

export async function approveSalesBulkCampaign(
  campaignId: string,
): Promise<NexiQSalesBulkApproveResult> {
  const res = await fetch(`${BASE}/bulk/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId }),
  });
  const parsed = await parseJson<{ result: NexiQSalesBulkApproveResult }>(res);
  return parsed.result;
}

export async function getSalesMetrics(): Promise<NexiQSalesMetrics> {
  const res = await fetch(`${BASE}/metrics`, { credentials: "include" });
  const body = await parseJson<{ metrics: NexiQSalesMetrics }>(res);
  return body.metrics;
}

export async function getSalesOutlookStatus(): Promise<NexiQOutlookStatus> {
  const res = await fetch(`${BASE}/outlook/status`, { credentials: "include" });
  const body = await parseJson<{ outlook: NexiQOutlookStatus }>(res);
  return body.outlook;
}

export async function connectSalesOutlook(): Promise<{
  authorizeUrl?: string;
  connected?: boolean;
  mock?: boolean;
  mailbox?: string;
}> {
  const res = await fetch(`${BASE}/outlook/connect`, { credentials: "include" });
  return parseJson(res);
}

export async function completeOutlookConnect(code: string, state: string): Promise<void> {
  const res = await fetch(`${BASE}/outlook/callback`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  });
  await parseJson(res);
}

export async function disconnectSalesOutlook(): Promise<void> {
  const res = await fetch(`${BASE}/outlook/disconnect`, {
    method: "POST",
    credentials: "include",
  });
  await parseJson(res);
}

export async function approveSalesSequence(sequenceId: string): Promise<NexiQSalesSequence> {
  const res = await fetch(`${BASE}/sequences/${encodeURIComponent(sequenceId)}/approve`, {
    method: "POST",
    credentials: "include",
  });
  const body = await parseJson<{ sequence: NexiQSalesSequence }>(res);
  return body.sequence;
}

export async function suppressSalesSequence(sequenceId: string): Promise<NexiQSalesSequence> {
  const res = await fetch(`${BASE}/sequences/${encodeURIComponent(sequenceId)}/suppress`, {
    method: "POST",
    credentials: "include",
  });
  const body = await parseJson<{ sequence: NexiQSalesSequence }>(res);
  return body.sequence;
}

export async function approveSalesDraft(draftId: string): Promise<NexiQSalesContentDraft> {
  const res = await fetch(`${BASE}/drafts/${encodeURIComponent(draftId)}/approve`, {
    method: "POST",
    credentials: "include",
  });
  const body = await parseJson<{ draft: NexiQSalesContentDraft }>(res);
  return body.draft;
}

export async function createSalesSequence(
  body: CreateNexiQSalesSequenceBody,
): Promise<NexiQSalesSequence> {
  const res = await fetch(`${BASE}/sequences`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ sequence: NexiQSalesSequence }>(res);
  return parsed.sequence;
}

export async function updateSalesSequence(
  sequenceId: string,
  body: UpdateNexiQSalesSequenceBody,
): Promise<NexiQSalesSequence> {
  const res = await fetch(`${BASE}/sequences/${encodeURIComponent(sequenceId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ sequence: NexiQSalesSequence }>(res);
  return parsed.sequence;
}

export async function updateSalesDraft(
  draftId: string,
  body: UpdateNexiQSalesDraftBody,
): Promise<NexiQSalesContentDraft> {
  const res = await fetch(`${BASE}/drafts/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ draft: NexiQSalesContentDraft }>(res);
  return parsed.draft;
}

export async function updateSalesBulkCopy(
  campaignId: string,
  steps: UpdateNexiQSalesSequenceBody["steps"],
): Promise<{ updated: number }> {
  const res = await fetch(`${BASE}/bulk`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, steps }),
  });
  const parsed = await parseJson<{ result: { updated: number } }>(res);
  return parsed.result;
}
