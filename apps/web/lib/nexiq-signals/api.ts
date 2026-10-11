import type {
  NexiqSignalListQuery,
  NexiqSignalRecord,
  NexiqSignalSummary,
  NexiqSignalVertical,
} from "rapid-cortex-shared";
import { emptyNexiqSignalSummary } from "rapid-cortex-shared";

export const NEXIQ_SIGNALS_QUERY_KEY = ["nexiq-signals"] as const;
export const NEXIQ_SIGNALS_SUMMARY_QUERY_KEY = ["nexiq-signals-summary"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof body === "object" && body && "error" in body && body.error
        ? String(body.error)
        : `Request failed (${res.status})`,
    );
  }
  return body;
}

export async function fetchNexiqSignalsSummary(): Promise<NexiqSignalSummary> {
  const res = await fetch("/api/signals/summary", { credentials: "include" });
  const body = await parseJson<{ success?: boolean } & NexiqSignalSummary>(res);
  return {
    ...emptyNexiqSignalSummary(),
    new: body.new ?? 0,
    tracking: body.tracking ?? 0,
    high_tier: body.high_tier ?? 0,
    pushed_to_crm: body.pushed_to_crm ?? 0,
    by_vertical: body.by_vertical ?? emptyNexiqSignalSummary().by_vertical,
  };
}

export async function listNexiqSignals(query: {
  status?: NexiqSignalListQuery["status"];
  vertical?: NexiqSignalVertical;
  tier?: NexiqSignalListQuery["tier"];
  limit?: number;
}): Promise<{ items: NexiqSignalRecord[] }> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.vertical) params.set("vertical", query.vertical);
  if (query.tier) params.set("tier", query.tier);
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const res = await fetch(`/api/signals${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  const body = await parseJson<{ items?: NexiqSignalRecord[] }>(res);
  return { items: body.items ?? [] };
}

export async function patchNexiqSignal(
  signalId: string,
  action: "track" | "dismiss" | "push_to_crm",
): Promise<{ signal?: NexiqSignalRecord; apolloAccountId?: string }> {
  const res = await fetch(`/api/signals/${encodeURIComponent(signalId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return parseJson(res);
}
