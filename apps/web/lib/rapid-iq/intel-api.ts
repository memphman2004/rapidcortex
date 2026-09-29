import type {
  NexiQIntelBidNoBid,
  NexiQIntelOpportunity,
  NexiQIntelOutreachAudience,
  NexiQIntelPursuitBrief,
  NexiQIntelWatch,
  NexiQRfpCountSnapshot,
} from "rapid-cortex-shared";

const BASE = "/api/rapid-iq/intel";

export const INTEL_OPPORTUNITIES_QUERY_KEY = ["rapid-iq-intel-opportunities"] as const;
export const INTEL_WATCHES_QUERY_KEY = ["rapid-iq-intel-watches"] as const;
export const RFP_COUNTS_QUERY_KEY = ["rapid-iq-rfp-counts"] as const;

export type IntelKpis = {
  newOpportunities: number;
  highFit: number;
  preRfpSignals: number;
  dueWithin30Days: number;
  estimatedPipeline: number;
  agenciesWatched: number;
};

export type IntelListResponse = {
  items: NexiQIntelOpportunity[];
  kpis: IntelKpis;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function listIntelOpportunities(
  params: Record<string, string | undefined> = {},
): Promise<IntelListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`${BASE}/opportunities${suffix}`, { credentials: "include" });
  return parseJson<IntelListResponse>(res);
}

export async function getIntelOpportunity(id: string): Promise<NexiQIntelOpportunity> {
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(id)}`, { credentials: "include" });
  const body = await parseJson<{ opportunity: NexiQIntelOpportunity }>(res);
  return body.opportunity;
}

export async function patchIntelOpportunity(
  id: string,
  body: Partial<{
    status: NexiQIntelOpportunity["status"];
    userFitScore: number;
    userWinSignal: number;
    userRecommendation: NexiQIntelOpportunity["recommendation"];
    userProcurementStage: number;
    notes: string;
  }>,
): Promise<NexiQIntelOpportunity> {
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ opportunity: NexiQIntelOpportunity }>(res);
  return parsed.opportunity;
}

export async function analyzeIntelOpportunity(id: string): Promise<NexiQIntelOpportunity> {
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(id)}/analyze`, {
    method: "POST",
    credentials: "include",
  });
  const parsed = await parseJson<{ opportunity: NexiQIntelOpportunity }>(res);
  return parsed.opportunity;
}

export async function generateIntelPursuitBrief(
  id: string,
): Promise<{ brief: NexiQIntelPursuitBrief; model: string }> {
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(id)}/pursuit-brief`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson(res);
}

export async function generateIntelOutreach(
  id: string,
  audience: NexiQIntelOutreachAudience,
): Promise<{ text: string; model: string }> {
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(id)}/outreach`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audience }),
  });
  return parseJson(res);
}

export async function generateIntelBidNoBid(
  id: string,
): Promise<{ analysis: NexiQIntelBidNoBid; model: string }> {
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(id)}/bid-no-bid`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson(res);
}

export async function listIntelWatches(): Promise<NexiQIntelWatch[]> {
  const res = await fetch(`${BASE}/watches`, { credentials: "include" });
  const body = await parseJson<{ watches: NexiQIntelWatch[] }>(res);
  return body.watches;
}

export async function patchIntelWatch(
  id: string,
  body: Partial<Pick<NexiQIntelWatch, "enabled" | "minimumFitScore" | "keywords" | "sourceUrls">>,
): Promise<NexiQIntelWatch> {
  const res = await fetch(`${BASE}/watches/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ watch: NexiQIntelWatch }>(res);
  return parsed.watch;
}

export async function runIntelWatch(id: string): Promise<unknown> {
  const res = await fetch(`${BASE}/watches/${encodeURIComponent(id)}/run`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson(res);
}

export async function fetchRfpCounts(): Promise<{ snapshot: NexiQRfpCountSnapshot | null }> {
  const res = await fetch(`${BASE}/rfp-counts`, { credentials: "include", cache: "no-store" });
  return parseJson(res);
}
