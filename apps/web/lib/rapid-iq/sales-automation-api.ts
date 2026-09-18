import type {
  CreateRapidIqSalesBulkCampaignBody,
  CreateRapidIqSalesSequenceBody,
  RapidIqOutlookStatus,
  RapidIqSalesBulkApproveResult,
  RapidIqSalesBulkBatch,
  RapidIqSalesBulkResult,
  RapidIqSalesCampaignCard,
  RapidIqSalesContentDraft,
  RapidIqSalesMetrics,
  RapidIqSalesSequence,
  UpdateRapidIqSalesDraftBody,
  UpdateRapidIqSalesSequenceBody,
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

export async function listSalesCampaigns(): Promise<{
  campaigns: RapidIqSalesCampaignCard[];
  batches: RapidIqSalesBulkBatch[];
}> {
  const res = await fetch(`${BASE}/campaigns`, { credentials: "include" });
  const body = await parseJson<{
    campaigns: RapidIqSalesCampaignCard[];
    batches?: RapidIqSalesBulkBatch[];
  }>(res);
  return { campaigns: body.campaigns ?? [], batches: body.batches ?? [] };
}

export async function createSalesBulkCampaign(
  body: CreateRapidIqSalesBulkCampaignBody,
): Promise<RapidIqSalesBulkResult> {
  const res = await fetch(`${BASE}/bulk`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ result: RapidIqSalesBulkResult }>(res);
  return parsed.result;
}

export async function approveSalesBulkCampaign(
  campaignId: string,
): Promise<RapidIqSalesBulkApproveResult> {
  const res = await fetch(`${BASE}/bulk/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId }),
  });
  const parsed = await parseJson<{ result: RapidIqSalesBulkApproveResult }>(res);
  return parsed.result;
}

export async function getSalesMetrics(): Promise<RapidIqSalesMetrics> {
  const res = await fetch(`${BASE}/metrics`, { credentials: "include" });
  const body = await parseJson<{ metrics: RapidIqSalesMetrics }>(res);
  return body.metrics;
}

export async function getSalesOutlookStatus(): Promise<RapidIqOutlookStatus> {
  const res = await fetch(`${BASE}/outlook/status`, { credentials: "include" });
  const body = await parseJson<{ outlook: RapidIqOutlookStatus }>(res);
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

export async function updateSalesSequence(
  sequenceId: string,
  body: UpdateRapidIqSalesSequenceBody,
): Promise<RapidIqSalesSequence> {
  const res = await fetch(`${BASE}/sequences/${encodeURIComponent(sequenceId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ sequence: RapidIqSalesSequence }>(res);
  return parsed.sequence;
}

export async function updateSalesDraft(
  draftId: string,
  body: UpdateRapidIqSalesDraftBody,
): Promise<RapidIqSalesContentDraft> {
  const res = await fetch(`${BASE}/drafts/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ draft: RapidIqSalesContentDraft }>(res);
  return parsed.draft;
}

export async function updateSalesBulkCopy(
  campaignId: string,
  steps: UpdateRapidIqSalesSequenceBody["steps"],
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
