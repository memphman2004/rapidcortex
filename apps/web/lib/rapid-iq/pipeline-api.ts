import type {
  CreateManualRapidIqPipelineSignalBody,
  EnqueueRapidIqPipelineFromOpportunityBody,
  PatchRapidIqPipelineSignalBody,
  PushRapidIqPipelineToCrmBody,
  RapidIqAgencyContact,
  RapidIqAgencyProfile,
  RapidIqPipelineCreditsResponse,
  RapidIqPipelineSignal,
  RapidIqPipelineSignalStatus,
  RapidIqResearchRequest,
  RapidIqResearchResponse,
} from "rapid-cortex-shared";

const BASE = "/api/rc-admin/rapid-iq/signals";
const CREDITS_PATH = "/api/rc-admin/rapid-iq/credits";
const AGENCIES_PATH = "/api/rc-admin/rapid-iq/agencies";
const RESEARCH_PATH = "/api/rc-admin/rapid-iq/research";

/** React Query key for pipeline signals (invalidate after status / CRM / enqueue). */
export const PIPELINE_SIGNALS_QUERY_KEY = ["rapid-iq-pipeline-signals"] as const;

/** React Query key for Apollo/Hunter credit status (invalidate after push-to-crm). */
export const PIPELINE_CREDITS_QUERY_KEY = ["rapid-iq-pipeline-credits"] as const;

export const PIPELINE_AGENCIES_QUERY_KEY = ["rapid-iq-pipeline-agencies"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export function countUnworkedPipelineItems(
  items: Array<{ status: RapidIqPipelineSignalStatus; sourceId?: string }>,
): number {
  return items.filter((i) => {
    if (i.status === "reviewed") return true;
    return i.status === "new" && i.sourceId === "rapid-iq";
  }).length;
}

export function pipelineOpportunityIdSet(
  items: RapidIqPipelineSignal[],
): Set<string> {
  const ids = new Set<string>();
  for (const signal of items) {
    if (signal.status === "dismissed") continue;
    if (signal.opportunityId) ids.add(signal.opportunityId);
    const hash = signal.sourceUrl.match(/#(.+)$/);
    if (hash?.[1] && signal.sourceId === "rapid-iq") {
      try {
        ids.add(decodeURIComponent(hash[1]));
      } catch {
        ids.add(hash[1]);
      }
    }
  }
  return ids;
}

export async function getPipelineSignals(
  status?: RapidIqPipelineSignalStatus,
): Promise<RapidIqPipelineSignal[]> {
  const url = status ? `${BASE}?status=${encodeURIComponent(status)}` : BASE;
  const res = await fetch(url, { credentials: "include" });
  const body = await parseJson<{ signals?: RapidIqPipelineSignal[]; items?: RapidIqPipelineSignal[] }>(
    res,
  );
  return body.signals ?? body.items ?? [];
}

export async function getPipelineCredits(): Promise<RapidIqPipelineCreditsResponse["credits"]> {
  const res = await fetch(CREDITS_PATH, { credentials: "include" });
  const body = await parseJson<RapidIqPipelineCreditsResponse>(res);
  return body.credits;
}

export async function patchPipelineSignalStatus(
  signalId: string,
  status: RapidIqPipelineSignalStatus,
): Promise<RapidIqPipelineSignal> {
  return patchPipelineSignal(signalId, { status });
}

export async function patchPipelineSignal(
  signalId: string,
  payload: PatchRapidIqPipelineSignalBody,
): Promise<RapidIqPipelineSignal> {
  const res = await fetch(`${BASE}/${encodeURIComponent(signalId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const resp = await parseJson<{ signal: RapidIqPipelineSignal }>(res);
  return resp.signal;
}

export async function pushPipelineSignalToCrm(
  signalId: string,
  payload: PushRapidIqPipelineToCrmBody,
): Promise<{
  leadId: string;
  enrichment?: {
    apolloCreditsUsed: number;
    hunterCreditsUsed: number;
    sources: string[];
    log: string[];
  };
}> {
  const res = await fetch(`${BASE}/${encodeURIComponent(signalId)}/push-to-crm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function enqueuePipelineFromOpportunity(
  body: EnqueueRapidIqPipelineFromOpportunityBody,
): Promise<{ signal: RapidIqPipelineSignal; alreadyQueued: boolean }> {
  const res = await fetch(BASE, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{
    signal?: RapidIqPipelineSignal;
    alreadyQueued?: boolean;
    data?: { signal: RapidIqPipelineSignal; alreadyQueued?: boolean };
  }>(res);
  const signal = parsed.signal ?? parsed.data?.signal;
  if (!signal) throw new Error("Missing pipeline signal in response");
  return {
    signal,
    alreadyQueued: Boolean(parsed.alreadyQueued ?? parsed.data?.alreadyQueued),
  };
}

export async function createManualPipelineSignal(
  body: CreateManualRapidIqPipelineSignalBody,
): Promise<{ signal: RapidIqPipelineSignal; alreadyQueued: boolean }> {
  const res = await fetch(BASE, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{
    signal?: RapidIqPipelineSignal;
    alreadyQueued?: boolean;
  }>(res);
  if (!parsed.signal) throw new Error("Missing pipeline signal in response");
  return { signal: parsed.signal, alreadyQueued: Boolean(parsed.alreadyQueued) };
}

export async function runRapidIqResearch(
  body: RapidIqResearchRequest,
): Promise<RapidIqResearchResponse> {
  const res = await fetch(RESEARCH_PATH, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<RapidIqResearchResponse>(res);
}

export async function getPipelineAgencies(): Promise<RapidIqAgencyProfile[]> {
  const res = await fetch(AGENCIES_PATH, { credentials: "include" });
  const body = await parseJson<{ agencies?: RapidIqAgencyProfile[] }>(res);
  return body.agencies ?? [];
}

export async function getPipelineAgencyDetail(agencyId: string): Promise<{
  agency: RapidIqAgencyProfile;
  contacts: RapidIqAgencyContact[];
  signals: RapidIqPipelineSignal[];
}> {
  const res = await fetch(`${AGENCIES_PATH}/${encodeURIComponent(agencyId)}`, {
    credentials: "include",
  });
  return parseJson(res);
}
