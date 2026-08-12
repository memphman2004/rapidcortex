import type {
  PatchRapidIqPipelineSignalBody,
  PushRapidIqPipelineToCrmBody,
  RapidIqPipelineCreditsResponse,
  RapidIqPipelineSignal,
  RapidIqPipelineSignalStatus,
} from "rapid-cortex-shared";

const BASE = "/api/rapid-iq/pipeline/signals";
const CREDITS_PATH = "/api/rapid-iq/pipeline/credits";

/** React Query key for Apollo/Hunter credit status (invalidate after push-to-crm). */
export const PIPELINE_CREDITS_QUERY_KEY = ["rapid-iq-pipeline-credits"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
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
  const payload: PatchRapidIqPipelineSignalBody = { status };
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
