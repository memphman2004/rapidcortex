/**
 * Response Continuity System (RCS) client — relative `/api/rcs/*` via Next.js BFF
 * (cookie session). Aligns with backend routes in `infra/nested/stack-app-sam-2-rcs.yaml`
 * and types in `rapid-cortex-shared`.
 */

import type {
  RcsAiSummary,
  RcsAudioAlertRequest,
  RcsCallCloseRequest,
  RcsCallEnriched,
  RcsCallStartRequest,
  RcsCallStateUpdateRequest,
  RcsEscalationRules,
  RcsFloorHealthSnapshot,
  RcsSoftHandoff,
  RcsSoftHandoffAcceptRequest,
  RcsSoftHandoffRequest,
  RcsUnitPositionRequest,
} from "rapid-cortex-shared";

/** Client call record includes optional intelligence-layer fields. */
export type RcsCall = RcsCallEnriched;

export type {
  RcsAiSummary,
  RcsAudioAlertRequest,
  RcsCallCloseRequest,
  RcsCallEnriched,
  RcsCallStartRequest,
  RcsCallStateUpdateRequest,
  RcsEscalationRules,
  RcsFloorHealthSnapshot,
  RcsSoftHandoff,
  RcsSoftHandoffAcceptRequest,
  RcsSoftHandoffRequest,
  RcsUnitPositionRequest,
} from "rapid-cortex-shared";

class RcsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RcsApiError";
    this.status = status;
  }
}

type RcsEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  items?: T[];
  call?: T;
  summary?: RcsAiSummary;
  handoff?: RcsSoftHandoff;
  rules?: RcsEscalationRules;
  snapshot?: RcsFloorHealthSnapshot;
};

async function rcsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/rcs${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  }
  if (!res.ok) {
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const message =
      (o && typeof o.error === "string" && o.error) ||
      (o && typeof o.message === "string" && o.message) ||
      `RCS request failed (${res.status})`;
    throw new RcsApiError(message, res.status);
  }
  const env = body as RcsEnvelope<T> | T;
  if (env && typeof env === "object" && "data" in env && (env as RcsEnvelope<T>).data !== undefined) {
    return (env as RcsEnvelope<T>).data as T;
  }
  if (env && typeof env === "object" && "call" in env && (env as RcsEnvelope<T>).call !== undefined) {
    return (env as RcsEnvelope<T>).call as T;
  }
  return env as T;
}

export async function rcsStartCall(input: RcsCallStartRequest): Promise<RcsCall> {
  return rcsRequest<RcsCall>("/calls", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rcsUpdateCallState(
  callId: string,
  input: RcsCallStateUpdateRequest,
): Promise<RcsCall> {
  return rcsRequest<RcsCall>(`/calls/${encodeURIComponent(callId)}/state`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function rcsListActiveCalls(): Promise<RcsCall[]> {
  const data = await rcsRequest<{ items?: RcsCall[]; calls?: RcsCall[] } | RcsCall[]>("/calls");
  if (Array.isArray(data)) return data;
  return data.items ?? data.calls ?? [];
}

export async function rcsCloseCall(callId: string, input: RcsCallCloseRequest = {}): Promise<RcsCall> {
  return rcsRequest<RcsCall>(`/calls/${encodeURIComponent(callId)}/close`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rcsSupervisorAck(callId: string, note?: string): Promise<RcsCall> {
  return rcsRequest<RcsCall>(`/calls/${encodeURIComponent(callId)}/acknowledge`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function rcsPostAudioAlert(
  callId: string,
  input: RcsAudioAlertRequest,
): Promise<RcsCall> {
  return rcsRequest<RcsCall>(`/calls/${encodeURIComponent(callId)}/audio-alert`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rcsPostUnitPosition(input: RcsUnitPositionRequest): Promise<RcsCall | { updated: boolean }> {
  return rcsRequest(`/units/position`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rcsGetCallSummary(callId: string): Promise<RcsAiSummary> {
  const data = await rcsRequest<{ summary?: RcsAiSummary } | RcsAiSummary>(
    `/calls/${encodeURIComponent(callId)}/summary`,
  );
  if (data && typeof data === "object" && "summary" in data && data.summary) {
    return data.summary;
  }
  return data as RcsAiSummary;
}

export async function rcsTriggerCallSummary(callId: string): Promise<RcsAiSummary> {
  const data = await rcsRequest<{ summary?: RcsAiSummary } | RcsAiSummary>(
    `/calls/${encodeURIComponent(callId)}/summary`,
    { method: "POST", body: "{}" },
  );
  if (data && typeof data === "object" && "summary" in data && data.summary) {
    return data.summary;
  }
  return data as RcsAiSummary;
}

export async function rcsRequestSoftHandoff(
  callId: string,
  input: RcsSoftHandoffRequest = {},
): Promise<RcsSoftHandoff> {
  const data = await rcsRequest<{ handoff?: RcsSoftHandoff; call?: RcsCall } | RcsSoftHandoff>(
    `/calls/${encodeURIComponent(callId)}/handoff`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (data && typeof data === "object" && "handoff" in data && data.handoff) return data.handoff;
  return data as RcsSoftHandoff;
}

export async function rcsAcceptSoftHandoff(
  callId: string,
  input: RcsSoftHandoffAcceptRequest,
): Promise<RcsSoftHandoff> {
  const data = await rcsRequest<{ handoff?: RcsSoftHandoff } | RcsSoftHandoff>(
    `/calls/${encodeURIComponent(callId)}/handoff/accept`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (data && typeof data === "object" && "handoff" in data && data.handoff) return data.handoff;
  return data as RcsSoftHandoff;
}

export async function rcsClearSoftHandoff(callId: string): Promise<void> {
  await rcsRequest(`/calls/${encodeURIComponent(callId)}/handoff`, { method: "DELETE" });
}

export async function rcsGetFloorHealth(): Promise<RcsFloorHealthSnapshot> {
  const data = await rcsRequest<{ snapshot?: RcsFloorHealthSnapshot } | RcsFloorHealthSnapshot>(
    "/floor-health",
  );
  if (data && typeof data === "object" && "snapshot" in data && data.snapshot) return data.snapshot;
  return data as RcsFloorHealthSnapshot;
}

export async function rcsGetEscalationRules(): Promise<RcsEscalationRules> {
  const data = await rcsRequest<{ rules?: RcsEscalationRules } | RcsEscalationRules>(
    "/escalation-rules",
  );
  if (data && typeof data === "object" && "rules" in data && data.rules) return data.rules;
  return data as RcsEscalationRules;
}

export async function rcsPutEscalationRules(
  input: Omit<RcsEscalationRules, "agencyId" | "updatedAt" | "updatedByUserId">,
): Promise<RcsEscalationRules> {
  const data = await rcsRequest<{ rules?: RcsEscalationRules } | RcsEscalationRules>(
    "/escalation-rules",
    { method: "PUT", body: JSON.stringify(input) },
  );
  if (data && typeof data === "object" && "rules" in data && data.rules) return data.rules;
  return data as RcsEscalationRules;
}

export { RcsApiError };
