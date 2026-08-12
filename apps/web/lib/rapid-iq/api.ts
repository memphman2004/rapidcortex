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
import { isCompetitorOpportunity } from "./competitor-registry";
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

/** Explicit opt-in only — production never silently substitutes demo inventory. */
function allowDemoFallback(): boolean {
  return (
    process.env.NEXT_PUBLIC_RAPID_IQ_DEMO === "1" ||
    process.env.NEXT_PUBLIC_RAPID_IQ_DEMO === "true"
  );
}

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

function unwrapItems<T>(body: ApiEnvelope<T[]> & { items?: T[]; contacts?: T[] }): T[] {
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.contacts)) return body.contacts;
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
    if (items.length === 0 && allowDemoFallback()) {
      return { items: filterDemoOpportunities(params), demo: true };
    }
    return { items, demo: false };
  } catch (err) {
    if (allowDemoFallback()) {
      return { items: filterDemoOpportunities(params), demo: true };
    }
    throw err instanceof Error ? err : new Error("Failed to load opportunities");
  }
}

export async function getOpportunityDetail(opportunityId: string): Promise<OpportunityDetailBundle | null> {
  const demoOpp = allowDemoFallback() ? getDemoOpportunity(opportunityId) : null;

  try {
    const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ApiEnvelope<RapidIqOpportunity> & {
      opportunity?: RapidIqOpportunity;
      signals?: RapidIqSignal[];
      contacts?: RapidIqContact[];
      sources?: RapidIqSource[];
      mentioned?: MentionedEntity[];
      opportunityId?: string;
    };

    const opportunity =
      body.opportunity ??
      (typeof body.data === "object" && body.data && "opportunityId" in (body.data as object)
        ? (body.data as RapidIqOpportunity)
        : null) ??
      (body.opportunityId ? (body as unknown as RapidIqOpportunity) : null);

    if (!opportunity?.opportunityId) throw new Error("Missing opportunity");

    let signals = Array.isArray(body.signals) ? body.signals : [];
    let contacts = Array.isArray(body.contacts) ? body.contacts : [];
    let sources = Array.isArray(body.sources) ? body.sources : [];
    let mentioned = Array.isArray(body.mentioned) ? body.mentioned : [];

    if (signals.length === 0 || contacts.length === 0 || sources.length === 0) {
      const [s, c, src] = await Promise.all([
        signals.length
          ? Promise.resolve(signals)
          : fetchSignals(opportunityId, false).catch(() => [] as RapidIqSignal[]),
        contacts.length
          ? Promise.resolve(contacts)
          : fetchContacts(opportunityId, false).catch(() => [] as RapidIqContact[]),
        sources.length
          ? Promise.resolve(sources)
          : fetchSources(opportunityId, false).catch(() => [] as RapidIqSource[]),
      ]);
      signals = s;
      contacts = c;
      sources = src;
    }
    if (mentioned.length === 0 && contacts.length > 0) {
      mentioned = contacts.slice(0, 8).map((c) => ({
        name: c.name ?? c.title,
        role: c.title,
        status: c.name ? ("found" as const) : ("not_found" as const),
        linkedContactId: c.name ? c.contactId : null,
      }));
    }

    return {
      opportunity,
      signals,
      contacts,
      sources,
      mentioned,
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
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}/signals`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await parseJson<ApiEnvelope<RapidIqSignal[]>>(res);
  return unwrapItems<RapidIqSignal>(body);
}

export async function fetchContacts(opportunityId: string, demo = false): Promise<RapidIqContact[]> {
  if (demo) return getDemoContacts(opportunityId);
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}/contacts`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await parseJson<ApiEnvelope<RapidIqContact[]>>(res);
  return unwrapItems<RapidIqContact>(body);
}

export async function fetchSources(opportunityId: string, demo = false): Promise<RapidIqSource[]> {
  if (demo) return getDemoSources(opportunityId);
  const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(opportunityId)}/sources`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await parseJson<ApiEnvelope<RapidIqSource[]>>(res);
  return unwrapItems<RapidIqSource>(body);
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
  const parsed = await parseJson<ApiEnvelope<RapidIqOpportunity> & RapidIqOpportunity>(res);
  const opp =
    (parsed as { data?: RapidIqOpportunity }).data ??
    ((parsed as RapidIqOpportunity).opportunityId ? (parsed as RapidIqOpportunity) : null);
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
  const res = await fetch(`${BASE}/talking-points`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { points?: string[]; data?: { points: string[] } };
  return body.points ?? body.data?.points ?? [];
}

export async function fetchOutreach(
  opportunityId: string,
  contactId?: string,
  demo = false,
): Promise<{ subject: string; body: string }> {
  if (demo) {
    return {
      subject: `Rapid Cortex — opportunity ${opportunityId}`,
      body: [
        "Hi Director,",
        "",
        "Demo outreach draft grounded in this Rapid IQ signal.",
        "",
        "Talking points for our conversation:",
        "1. Reference the signal in your opener.",
        "2. Ask about evaluation timeline.",
        "3. Ask which budget cycle funds the modernization.",
        "4. Ask which CAD/NG911 stack they run today.",
        "5. Offer a Rapid Cortex Core demo.",
        "",
        "Best,",
        "Rapid Cortex",
      ].join("\n"),
    };
  }
  const res = await fetch(`${BASE}/outreach`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId, contactId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    subject?: string;
    body?: string;
    data?: { subject: string; body: string };
  };
  return {
    subject: body.subject ?? body.data?.subject ?? "",
    body: body.body ?? body.data?.body ?? "",
  };
}

export type RfpOutlineResult = {
  executiveSummary: string;
  requirements: { requirement: string; rcCapability: string; rcFeature: string }[];
  differentiators: string[];
  potentialConcerns: string[];
  recommendedApproach: string;
};

export async function fetchRfpOutline(
  opportunityId: string,
  demo = false,
): Promise<RfpOutlineResult> {
  if (demo) {
    return {
      executiveSummary: "Demo RFP outline — enable live API for Claude analysis.",
      requirements: [],
      differentiators: [],
      potentialConcerns: [],
      recommendedApproach: "",
    };
  }
  const res = await fetch(`${BASE}/rfp-outline`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as RfpOutlineResult & { data?: RfpOutlineResult };
  return body.data ?? body;
}

export type AgencyProfileResult = {
  annualCallVolume: number | null;
  dispatcherCount: number | null;
  populationServed: number | null;
  estimatedBudget: number | null;
  currentCadVendor: string | null;
  cadNotes: string | null;
  agencyWebsite: string | null;
  psapType: string | null;
  notes: string;
};

export async function fetchAgencyProfile(
  opportunityId: string,
  demo = false,
): Promise<AgencyProfileResult> {
  if (demo) {
    return {
      annualCallVolume: 420_000,
      dispatcherCount: 48,
      populationServed: 850_000,
      estimatedBudget: 2_100_000,
      currentCadVendor: "CentralSquare",
      cadNotes: "Demo CAD vendor",
      agencyWebsite: null,
      psapType: "Primary PSAP / ECC",
      notes: "Demo profile — live research requires Anthropic.",
    };
  }
  const res = await fetch(`${BASE}/agency-profile`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as AgencyProfileResult & { data?: AgencyProfileResult };
  return body.data ?? body;
}

export async function fetchAgencyResearch(
  opportunityId: string,
  demo = false,
): Promise<string> {
  if (demo) return "Demo agency research brief.";
  const res = await fetch(`${BASE}/research-agency`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { research?: string; data?: { research: string } };
  return body.research ?? body.data?.research ?? "";
}

export async function fetchCompetitorIntel(
  opportunityId: string,
  demo = false,
): Promise<string> {
  if (demo) return "Demo competitor displacement intel.";
  const res = await fetch(`${BASE}/competitor-intel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { intel?: string; data?: { intel: string } };
  return body.intel ?? body.data?.intel ?? "";
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
    const body = (await res.json().catch(() => ({}))) as {
      reply?: string;
      content?: string;
      data?: { reply: string };
      error?: string;
      detail?: string;
    };
    if (!res.ok) {
      return `Error: ${body.error ?? `HTTP ${res.status}`}${body.detail ? ` (${body.detail})` : ""}`;
    }
    return body.reply ?? body.content ?? body.data?.reply ?? `Error: empty chat response`;
  } catch (err) {
    return `Network error: ${err instanceof Error ? err.message : "Unknown error"}. Check your connection.`;
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
  const res = await fetch(`${BASE}/search-contacts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId, query }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await parseJson<ApiEnvelope<RapidIqContact[]> & { contacts?: RapidIqContact[] }>(res);
  return unwrapItems<RapidIqContact>(body);
}

function isRefreshStatus(value: unknown): value is RefreshStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as RefreshStatus).status === "string"
  );
}

export async function fetchRefreshStatus(demo = false): Promise<RefreshStatus> {
  if (demo) return DEMO_REFRESH_STATUS;
  const res = await fetch(`${BASE}/refresh/status`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as ApiEnvelope<RefreshStatus> & RefreshStatus;
  if (isRefreshStatus(body.data)) return body.data;
  if (isRefreshStatus(body)) return body;
  return {
    status: "idle",
    startedAt: null,
    completedAt: null,
    signalsFound: 0,
    error: null,
  };
}

export async function triggerRefresh(demo = false, source: "manual" | "ramp" = "manual"): Promise<void> {
  if (demo) return;
  const res = await fetch(`${BASE}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: source === "ramp" ? "ramp" : "manual-refresh" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export function computeStats(opportunities: RapidIqOpportunity[]): RapidIqStats {
  return {
    opportunities: opportunities.length,
    rfps: opportunities.filter((o) => o.tags.includes("RFP LIVE")).length,
    competitor: opportunities.filter((o) => isCompetitorOpportunity(o)).length,
    grantFunding: opportunities.filter((o) => o.tags.includes("GRANT FUNDING")).length,
  };
}

export function demoStats(vertical?: RapidIqVertical): RapidIqStats {
  return demoStatsForVertical(vertical);
}

export const OPPORTUNITIES_QUERY_KEY = ["rapid-iq-opportunities"] as const;
export const REFRESH_STATUS_QUERY_KEY = ["rapid-iq-refresh-status"] as const;
