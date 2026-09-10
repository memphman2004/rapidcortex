import { PLATFORM_AGENCY_ID } from "rapid-cortex-shared";

class CallAssistApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CallAssistApiError";
    this.status = status;
  }
}

/** Appends `agencyId` for RC-ops tenant override. Customers omit it (JWT tenant). */
export function withCallAssistAgencyQuery(path: string, agencyId?: string | null): string {
  const id = agencyId?.trim();
  if (!id || id === PLATFORM_AGENCY_ID) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}agencyId=${encodeURIComponent(id)}`;
}

async function callAssistRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new CallAssistApiError(err.error ?? `Call Assist request failed (${res.status})`, res.status);
  }
  return body as T;
}

export function listCallAssistSessions(status: "open" | "done" = "open", agencyId?: string | null) {
  return callAssistRequest<{ items: Array<Record<string, unknown>>; count: number }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions?status=${status}`, agencyId),
  );
}

export function getCallAssistSession(sessionId: string, agencyId?: string | null) {
  return callAssistRequest<{ session: Record<string, unknown>; handoff: Record<string, unknown> | null }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}`, agencyId),
  );
}

export function postCallAssistUtterance(sessionId: string, text: string, agencyId?: string | null) {
  return callAssistRequest(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/utterances`, agencyId),
    {
      method: "POST",
      body: JSON.stringify({ sessionId, text, speaker: "caller" }),
    },
  );
}

export function getCallAssistGreetingPreview(
  locale = "en-US",
  draft?: Record<string, string>,
  agencyId?: string | null,
) {
  const params = new URLSearchParams({ locale, ...(draft ?? {}) });
  return callAssistRequest<{
    locale: string;
    greeting: string;
    greetings: Record<string, string>;
    escalationAnnouncement: string;
    greetingReady: boolean;
    greetingActivationBlocked: string | null;
  }>(withCallAssistAgencyQuery(`/api/call-assist/admin/greeting/preview?${params.toString()}`, agencyId));
}

export function getCallAssistConfig(agencyId?: string | null) {
  return callAssistRequest<{ config: Record<string, unknown> }>(
    withCallAssistAgencyQuery("/api/call-assist/admin/config", agencyId),
  );
}

export function getCallAssistRuntimeConfig(agencyId?: string | null) {
  return callAssistRequest<{
    config: Record<string, unknown>;
    taxonomy: import("rapid-cortex-shared").AgencyTaxonomy;
    currentShift: string | null;
    onboardingComplete: boolean;
    agencyId?: string;
  }>(withCallAssistAgencyQuery("/api/call-assist/config", agencyId));
}

export function patchCallAssistConfig(body: Record<string, unknown>, agencyId?: string | null) {
  return callAssistRequest<{ config: Record<string, unknown> }>(
    withCallAssistAgencyQuery("/api/call-assist/admin/config", agencyId),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function patchCallAssistShift(currentShift: string, agencyId?: string | null) {
  return callAssistRequest<{ currentShift: string }>(withCallAssistAgencyQuery("/api/call-assist/shift", agencyId), {
    method: "PATCH",
    body: JSON.stringify({ currentShift }),
  });
}

export function getCallAssistExternalAgencies(agencyId?: string | null) {
  return callAssistRequest<{ items: Array<Record<string, unknown>> }>(
    withCallAssistAgencyQuery("/api/call-assist/external-agencies", agencyId),
  );
}

export function getCallAssistRecordsRequests(agencyId?: string | null) {
  return callAssistRequest<{ items: Array<Record<string, unknown>> }>(
    withCallAssistAgencyQuery("/api/call-assist/records-requests", agencyId),
  );
}

export function postCallAssistRecordsRequest(body: Record<string, unknown>, agencyId?: string | null) {
  return callAssistRequest(withCallAssistAgencyQuery("/api/call-assist/records-requests", agencyId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCallAssistDemoScenarios(agencyId?: string | null) {
  return callAssistRequest<{ items: Array<Record<string, unknown>> }>(
    withCallAssistAgencyQuery("/api/call-assist/demo/scenarios", agencyId),
  );
}

export function runCallAssistDemo(scenarioId: string, agencyId?: string | null) {
  return callAssistRequest<{ result: Record<string, unknown> }>(
    withCallAssistAgencyQuery("/api/call-assist/demo/run", agencyId),
    {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    },
  );
}

export function getCallAssistAnalytics(agencyId?: string | null) {
  return callAssistRequest<{
    openSessions: number;
    emergencyTransfers: number;
    surveyCount: number;
    surveyAverage: number | null;
    dashboard?: import("rapid-cortex-shared").CallAssistAnalyticsDashboard;
  }>(withCallAssistAgencyQuery("/api/call-assist/analytics", agencyId));
}

export function getCallAssistAnalyticsDashboard(
  filters: Record<string, string>,
  agencyId?: string | null,
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v.trim()) params.set(k, v.trim());
  }
  const qs = params.toString();
  return callAssistRequest<{ dashboard: import("rapid-cortex-shared").CallAssistAnalyticsDashboard }>(
    withCallAssistAgencyQuery(`/api/call-assist/analytics/dashboard${qs ? `?${qs}` : ""}`, agencyId),
  );
}

export function getCallAssistCallbackQueue(agencyId?: string | null) {
  return callAssistRequest<{
    queued: Array<Record<string, unknown>>;
    inProgress: Array<Record<string, unknown>>;
    offered: Array<Record<string, unknown>>;
  }>(withCallAssistAgencyQuery("/api/call-assist/callbacks/queue", agencyId));
}

export function postCallAssistCallbackOffer(sessionId: string, phoneE164?: string, agencyId?: string | null) {
  return callAssistRequest<{ session: Record<string, unknown> }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/callback/offer`, agencyId),
    { method: "POST", body: JSON.stringify({ sessionId, phoneE164 }) },
  );
}

export function postCallAssistCallbackDecision(sessionId: string, accept: boolean, agencyId?: string | null) {
  return callAssistRequest<{ session: Record<string, unknown> }>(
    withCallAssistAgencyQuery(
      `/api/call-assist/sessions/${encodeURIComponent(sessionId)}/callback/decision`,
      agencyId,
    ),
    { method: "POST", body: JSON.stringify({ sessionId, accept }) },
  );
}

export function postCallAssistCallbackTakeover(sessionId: string, agencyId?: string | null) {
  return callAssistRequest<{ session: Record<string, unknown> }>(
    withCallAssistAgencyQuery(
      `/api/call-assist/sessions/${encodeURIComponent(sessionId)}/callback/takeover`,
      agencyId,
    ),
    { method: "POST", body: JSON.stringify({ sessionId }) },
  );
}

export function postCallAssistSmsSelfService(sessionId: string, phoneE164?: string, agencyId?: string | null) {
  return callAssistRequest<{ session: Record<string, unknown> }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/sms-self-service`, agencyId),
    { method: "POST", body: JSON.stringify({ sessionId, phoneE164 }) },
  );
}

export function postCallAssistRmsFile(sessionId: string, target?: string, agencyId?: string | null) {
  return callAssistRequest<{
    result: { ok?: boolean; blocked?: boolean; reason?: string; reportNumber?: string };
    session: Record<string, unknown>;
  }>(withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/rms-file`, agencyId), {
    method: "POST",
    body: JSON.stringify({ sessionId, target, humanReviewApproved: true }),
  });
}

export function getCallAssistQaDashboard(agencyId?: string | null) {
  return callAssistRequest<{ dashboard: import("rapid-cortex-shared").CallAssistQaDashboard }>(
    withCallAssistAgencyQuery("/api/call-assist/qa/dashboard", agencyId),
  );
}

export function searchCallAssistQa(query: Record<string, string>, agencyId?: string | null) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v.trim()) params.set(k, v.trim());
  }
  return callAssistRequest<{ items: Array<Record<string, unknown>> }>(
    withCallAssistAgencyQuery(`/api/call-assist/qa/search?${params.toString()}`, agencyId),
  );
}

export function getCallAssistSessionQa(sessionId: string, agencyId?: string | null) {
  return callAssistRequest<{
    session: Record<string, unknown>;
    review: import("rapid-cortex-shared").CallAssistQaReview | null;
    playback: Array<{ sequence?: number; speaker: string; text: string; at?: string }>;
  }>(withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/qa`, agencyId));
}

export function postCallAssistQaScore(sessionId: string, agencyId?: string | null) {
  return callAssistRequest<{ review: import("rapid-cortex-shared").CallAssistQaReview }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/qa/score`, agencyId),
    { method: "POST", body: JSON.stringify({ sessionId }) },
  );
}

export function postCallAssistQaReview(
  sessionId: string,
  body: { aggregateScore?: number; notes?: string; falseTransfer?: boolean },
  agencyId?: string | null,
) {
  return callAssistRequest<{ review: import("rapid-cortex-shared").CallAssistQaReview }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/qa/review`, agencyId),
    { method: "POST", body: JSON.stringify({ sessionId, ...body }) },
  );
}

export function getCallAssistRetention(agencyId?: string | null) {
  return callAssistRequest<{
    retention: Record<string, unknown>;
    lastRun: Record<string, unknown> | null;
  }>(withCallAssistAgencyQuery("/api/call-assist/retention", agencyId));
}

export function patchCallAssistRetention(body: Record<string, unknown>, agencyId?: string | null) {
  return callAssistRequest<{ retention: Record<string, unknown>; lastRun: Record<string, unknown> | null }>(
    withCallAssistAgencyQuery("/api/call-assist/retention", agencyId),
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function getCallAssistPrompts(agencyId?: string | null) {
  return callAssistRequest<{ items: import("rapid-cortex-shared").CallAssistPromptRecord[] }>(
    withCallAssistAgencyQuery("/api/call-assist/prompts", agencyId),
  );
}

export function postCallAssistPrompt(
  body: { promptId: string; body: string },
  agencyId?: string | null,
) {
  return callAssistRequest<{
    record: import("rapid-cortex-shared").CallAssistPromptRecord;
    diff: import("rapid-cortex-shared").PromptDiffLine[];
  }>(withCallAssistAgencyQuery("/api/call-assist/prompts", agencyId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postCallAssistPromptRollback(
  body: { promptId: string; version: number },
  agencyId?: string | null,
) {
  return callAssistRequest<{ record: import("rapid-cortex-shared").CallAssistPromptRecord }>(
    withCallAssistAgencyQuery("/api/call-assist/prompts/rollback", agencyId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function postCallAssistTransferOutcome(
  sessionId: string,
  body: { outcome: string; failureReason?: string },
  agencyId?: string | null,
) {
  return callAssistRequest<{
    items: import("rapid-cortex-shared").CallAssistTransferLedgerEntry[];
    session: unknown;
  }>(
    withCallAssistAgencyQuery(
      `/api/call-assist/sessions/${encodeURIComponent(sessionId)}/transfer-outcome`,
      agencyId,
    ),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getCallAssistSessionTransfers(sessionId: string, agencyId?: string | null) {
  return callAssistRequest<{
    items: import("rapid-cortex-shared").CallAssistTransferLedgerEntry[];
    lastOutcome: string | null;
  }>(withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/transfers`, agencyId));
}

export function getCallAssistPromptProposals(agencyId?: string | null) {
  return callAssistRequest<{ items: import("rapid-cortex-shared").CallAssistPromptProposal[] }>(
    withCallAssistAgencyQuery("/api/call-assist/prompt-proposals", agencyId),
  );
}

export function postCallAssistQaProposePrompt(
  sessionId: string,
  body: { promptId?: string; proposedBody?: string; findingSummary?: string },
  agencyId?: string | null,
) {
  return callAssistRequest<{ proposal: import("rapid-cortex-shared").CallAssistPromptProposal }>(
    withCallAssistAgencyQuery(
      `/api/call-assist/sessions/${encodeURIComponent(sessionId)}/qa/propose-prompt`,
      agencyId,
    ),
    { method: "POST", body: JSON.stringify({ sessionId, ...body }) },
  );
}

export function postCallAssistPromptProposalDecision(
  proposalId: string,
  body: { decision: "approve" | "reject" | "withdraw"; reviewNotes?: string },
  agencyId?: string | null,
) {
  return callAssistRequest<{ proposal: import("rapid-cortex-shared").CallAssistPromptProposal }>(
    withCallAssistAgencyQuery(`/api/call-assist/prompt-proposals/${encodeURIComponent(proposalId)}/decision`, agencyId),
    { method: "POST", body: JSON.stringify({ proposalId, ...body }) },
  );
}

export function getCallAssistSchedule(agencyId?: string | null) {
  return callAssistRequest<{
    open: boolean;
    hours: Record<string, unknown>;
    onboardingComplete?: boolean;
    notice?: import("rapid-cortex-shared").PsapAvailabilityNotice;
  }>(withCallAssistAgencyQuery("/api/call-assist/schedule", agencyId));
}

export function listCallAssistKnowledge(agencyId?: string | null) {
  return callAssistRequest<{ items: CallAssistKnowledgeArticleDto[] }>(
    withCallAssistAgencyQuery("/api/call-assist/knowledge", agencyId),
  );
}

export function upsertCallAssistKnowledge(
  body: {
    articleId?: string;
    title: string;
    body: string;
    tags?: string[];
    enabled?: boolean;
    source?: string;
    sourceType?: "manual" | "url" | "policy" | "import";
  },
  agencyId?: string | null,
) {
  return callAssistRequest<{ article: CallAssistKnowledgeArticleDto }>(
    withCallAssistAgencyQuery("/api/call-assist/knowledge", agencyId),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function deleteCallAssistKnowledge(articleId: string, agencyId?: string | null) {
  return callAssistRequest<{ ok: boolean }>(
    withCallAssistAgencyQuery(`/api/call-assist/knowledge/${encodeURIComponent(articleId)}`, agencyId),
    { method: "DELETE" },
  );
}

export type CallAssistKnowledgeArticleDto = {
  articleId: string;
  title: string;
  body: string;
  tags: string[];
  enabled: boolean;
  updatedAt: string;
  source?: string;
  sourceType?: string;
  version?: number;
  previousBodies?: Array<{ version: number; title: string; body: string; updatedAt: string }>;
};

export function getCallAssistUiProfile(agencyId?: string | null) {
  return callAssistRequest<{ profile: import("rapid-cortex-shared").CallAssistUiProfile }>(
    withCallAssistAgencyQuery("/api/call-assist/ui-profile", agencyId),
  );
}

export function postCallAssistTransfer(
  sessionId: string,
  body: { reason: string; destinationType?: string },
  agencyId?: string | null,
) {
  return callAssistRequest<{ session: Record<string, unknown> }>(
    withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/transfer`, agencyId),
    {
      method: "POST",
      body: JSON.stringify({ sessionId, ...body }),
    },
  );
}

export function postCallAssistCadPush(sessionId: string, agencyId?: string | null) {
  return callAssistRequest<{
    result: { ok?: boolean; blocked?: boolean; reason?: string; cadIncidentId?: string };
    session: Record<string, unknown>;
  }>(withCallAssistAgencyQuery(`/api/call-assist/sessions/${encodeURIComponent(sessionId)}/cad-push`, agencyId), {
    method: "POST",
    body: JSON.stringify({ sessionId, humanReviewApproved: true }),
  });
}

export function getCallAssistBidMatrix(agencyId?: string | null) {
  return callAssistRequest<{ items: Array<Record<string, unknown>> }>(
    withCallAssistAgencyQuery("/api/call-assist/bid-matrix", agencyId),
  );
}

export type CallAssistFleetBot = {
  agencyId: string;
  agencyDisplayName: string;
  botName: string | null;
  status: string;
  templateVersion: string | null;
  current: boolean;
  onboardingStatus: string | null;
};

export type CallAssistLexQuota = {
  currentBotCount: number;
  limit: number;
  headroom: number;
  quotaCode: string;
};

export type CallAssistBotFleetResponse = {
  bots: CallAssistFleetBot[];
  quota: CallAssistLexQuota;
  templateVersion: string;
  outdatedCount: number;
  pendingRebuilds: number;
  estimatedRebuildMinutes: number;
  quotaBlocking: boolean;
  quotaConsoleUrl: string;
};

export function getCallAssistBotFleet() {
  return callAssistRequest<CallAssistBotFleetResponse>("/api/call-assist/bots");
}

export function postCallAssistBotRebuild(agencyId: string) {
  return callAssistRequest<{ queued: boolean; agencyId: string }>(
    `/api/call-assist/bots/${encodeURIComponent(agencyId)}/rebuild`,
    { method: "POST", body: "{}" },
  );
}

export function postCallAssistRebuildAllOutdated() {
  return callAssistRequest<{ enqueued: number }>("/api/call-assist/bots/rebuild-all-outdated", {
    method: "POST",
    body: "{}",
  });
}

export function getCallAssistBotQuota() {
  return callAssistRequest<{
    quota: CallAssistLexQuota;
    templateVersion: string;
    quotaBlocking: boolean;
    quotaConsoleUrl: string;
  }>("/api/call-assist/bots/quota");
}

export { CallAssistApiError };
