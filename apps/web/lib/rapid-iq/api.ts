import type {
  ConvertToLeadBody,
  RapidIqContact,
  RapidIqOpportunity,
  RapidIqSignal,
  RapidIqSource,
  RapidIqVertical,
  RefreshStatus,
  SignalChatMessage,
  UpdateOpportunityBody,
} from "./types";
import type { MentionedEntity, OpportunityListParams, RapidIqStats } from "./types";
import {
  DEMO_REFRESH_STATUS,
  demoSignalChatReply,
  demoStatsForVertical,
  demoTalkingPoints,
  filterDemoOpportunities,
  getDemoContacts,
  getDemoMentioned,
  getDemoOpportunity,
  getDemoSignals,
  getDemoSources,
} from "./seed-demo-data";

const BASE = "/api/rapid-iq";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  items?: T;
  error?: string;
};

export type ListOpportunitiesResult = {
  items: RapidIqOpportunity[];
  demo: boolean;
};

export type OpportunityDetailBundle = {
  opportunity: RapidIqOpportunity;
  signals: RapidIqSignal[];
  contacts: RapidIqContact[];
  sources: RapidIqSource[];
  mentioned: MentionedEntity[];
  demo: boolean;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

function unwrapItems<T>(body: ApiEnvelope<T[]> & { items?: T[] }): T[] {
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.data)) return body.data;
  return [];
}

function buildListQuery(params: OpportunityListParams): string {
  const q = new URLSearchParams();
  if (params.vertical) q.set("vertical", params.vertical);
  if (params.state) q.set("state", params.state);
  if (params.intentStage) q.set("intentStage", params.intentStage);
  if (params.search) q.set("search", params.search);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listOpportunities(params: OpportunityListParams = {}): Promise<ListOpportunitiesResult> {
  try {
    const res = await fetch(`${BASE}/opportunities${buildListQuery(params)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ApiEnvelope<RapidIqOpportunity[]>;
    const items = unwrapItems<RapidIqOpportunity>(body);
    if (items.length === 0) {
      return { items: filterDemoOpportunities(params), demo: true };
    }
    return { items, demo: false };
  } catch {
    return { items: filterDemoOpportunities(params), demo: true };
  }
}

export async function getOpportunityDetail(opportunityId: string): Promise<OpportunityDetailBundle | null> {
  const demoOpp = getDemoOpportunity(opportunityId);

  try {
    const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ApiEnvelope<RapidIqOpportunity> & {
      signals?: RapidIqSignal[];
      contacts?: RapidIqContact[];
      sources?: RapidIqSource[];
      mentioned?: MentionedEntity[];
    };
    const opportunity = body.data ?? body.items;
    if (!opportunity) throw new Error("Missing opportunity");
    return {
      opportunity,
      signals: body.signals ?? [],
      contacts: body.contacts ?? [],
      sources: body.sources ?? [],
      mentioned: body.mentioned ?? [],
      demo: false,
    };
  } catch {
    if (!demoOpp) return null;
    return {
      opportunity: demoOpp,
      signals: getDemoSignals(opportunityId),
      contacts: getDemoContacts(opportunityId),
      sources: getDemoSources(opportunityId),
      mentioned: getDemoMentioned(opportunityId),
      demo: true,
    };
  }
}

export async function fetchSignals(opportunityId: string, demo = false): Promise<RapidIqSignal[]> {
  if (demo) return getDemoSignals(opportunityId);
  try {
    const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}/signals`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await parseJson<ApiEnvelope<RapidIqSignal[]>>(res);
    return unwrapItems<RapidIqSignal>(body);
  } catch {
    return getDemoSignals(opportunityId);
  }
}

export async function fetchContacts(opportunityId: string, demo = false): Promise<RapidIqContact[]> {
  if (demo) return getDemoContacts(opportunityId);
  try {
    const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}/contacts`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await parseJson<ApiEnvelope<RapidIqContact[]>>(res);
    return unwrapItems<RapidIqContact>(body);
  } catch {
    return getDemoContacts(opportunityId);
  }
}

export async function fetchSources(opportunityId: string, demo = false): Promise<RapidIqSource[]> {
  if (demo) return getDemoSources(opportunityId);
  try {
    const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}/sources`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await parseJson<ApiEnvelope<RapidIqSource[]>>(res);
    return unwrapItems<RapidIqSource>(body);
  } catch {
    return getDemoSources(opportunityId);
  }
}

export async function updateOpportunity(
  opportunityId: string,
  body: UpdateOpportunityBody,
  demo = false,
): Promise<RapidIqOpportunity> {
  if (demo) {
    const opp = getDemoOpportunity(opportunityId);
    if (!opp) throw new Error("Opportunity not found");
    return { ...opp, ...body, tags: body.tags ?? opp.tags };
  }
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<ApiEnvelope<RapidIqOpportunity>>(res);
  const opp = parsed.data ?? parsed.items;
  if (!opp) throw new Error("Missing opportunity in response");
  return opp;
}

export async function convertToLead(body: ConvertToLeadBody, demo = false): Promise<{ leadId: string }> {
  if (demo) {
    return { leadId: `demo-lead-${body.opportunityId}` };
  }
  const res = await fetch(`${BASE}/convert-to-lead`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ leadId?: string; data?: { leadId: string } }>(res);
  return { leadId: parsed.leadId ?? parsed.data?.leadId ?? "unknown" };
}

export async function fetchTalkingPoints(
  opportunityId: string,
  demo = false,
): Promise<string[]> {
  if (demo) return demoTalkingPoints(opportunityId);
  try {
    const res = await fetch(`${BASE}/talking-points`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { points?: string[]; data?: { points: string[] } };
    return body.points ?? body.data?.points ?? demoTalkingPoints(opportunityId);
  } catch {
    return demoTalkingPoints(opportunityId);
  }
}

export async function fetchSignalChat(
  opportunityId: string,
  history: SignalChatMessage[],
  demo = false,
): Promise<string> {
  const message = history[history.length - 1]?.content ?? "";
  if (demo) return demoSignalChatReply(opportunityId, message);
  try {
    const res = await fetch(`${BASE}/signal-chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, message, history: history.slice(0, -1) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { reply?: string; content?: string; data?: { reply: string } };
    return body.reply ?? body.content ?? body.data?.reply ?? demoSignalChatReply(opportunityId, message);
  } catch {
    return demoSignalChatReply(opportunityId, message);
  }
}

export async function searchContactsLive(
  opportunityId: string,
  query?: string,
  demo = false,
): Promise<RapidIqContact[]> {
  if (demo) {
    const contacts = getDemoContacts(opportunityId);
    if (!query?.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q),
    );
  }
  try {
    const res = await fetch(`${BASE}/search-contacts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await parseJson<ApiEnvelope<RapidIqContact[]>>(res);
    return unwrapItems<RapidIqContact>(body);
  } catch {
    return getDemoContacts(opportunityId);
  }
}

export async function fetchRefreshStatus(demo = false): Promise<RefreshStatus> {
  if (demo) return DEMO_REFRESH_STATUS;
  try {
    const res = await fetch(`${BASE}/refresh/status`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ApiEnvelope<RefreshStatus>;
    return body.data ?? DEMO_REFRESH_STATUS;
  } catch {
    return DEMO_REFRESH_STATUS;
  }
}

export async function triggerRefresh(demo = false): Promise<void> {
  if (demo) return;
  const res = await fetch(`${BASE}/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export function computeStats(opportunities: RapidIqOpportunity[]): RapidIqStats {
  return {
    opportunities: opportunities.length,
    rfps: opportunities.filter((o) => o.tags.includes("RFP LIVE")).length,
    competitor: opportunities.filter((o) => o.tags.includes("COMPETITOR")).length,
    grantFunding: opportunities.filter((o) => o.tags.includes("GRANT FUNDING")).length,
  };
}

export function demoStats(vertical?: RapidIqVertical): RapidIqStats {
  return demoStatsForVertical(vertical);
}

export const OPPORTUNITIES_QUERY_KEY = ["rapid-iq-opportunities"] as const;
export const REFRESH_STATUS_QUERY_KEY = ["rapid-iq-refresh-status"] as const;
