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
  }>(withCallAssistAgencyQuery("/api/call-assist/analytics", agencyId));
}

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
