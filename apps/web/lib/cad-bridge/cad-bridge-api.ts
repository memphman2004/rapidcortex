import type { CADBridgeConfig, ConflictRecord, BridgeAuditRecord, CanonicalIncident } from "rapid-cortex-shared";

class CadBridgeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CadBridgeApiError";
    this.status = status;
  }
}

async function cadBridgeRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new CadBridgeApiError(err.error ?? `CAD Bridge request failed (${res.status})`, res.status);
  }
  return body as T;
}

export function fetchCadBridgeConfig() {
  return cadBridgeRequest<{
    config: CADBridgeConfig;
    brokerNotice: string;
    writebackEnabled: boolean;
    mockMode: boolean;
  }>("/api/cad-bridge/config");
}

export function putCadBridgeConfig(config: Omit<CADBridgeConfig, "agencyId" | "createdAt" | "updatedAt">) {
  return cadBridgeRequest<{ config: CADBridgeConfig }>("/api/cad-bridge/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function patchCadBridgeEnabled(enabled: boolean) {
  return cadBridgeRequest<{ config: CADBridgeConfig }>("/api/cad-bridge/config/enabled", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function fetchCadBridgeHealth() {
  return cadBridgeRequest<{
    enabled: boolean;
    mockMode: boolean;
    writebackEnabled: boolean;
    brokerNotice: string;
    cadA: { vendor?: string; circuit: string; inbound?: boolean };
    cadB: { vendor?: string; circuit: string; inbound?: boolean };
    pendingBufferSize: number;
  }>("/api/cad-bridge/health");
}

export function fetchCadBridgeConflicts() {
  return cadBridgeRequest<{ items: Array<ConflictRecord & { rcIncidentId: string }> }>("/api/cad-bridge/conflicts");
}

export function resolveCadBridgeConflict(conflictId: string, resolution: string, keepSlot?: "CAD_A" | "CAD_B") {
  return cadBridgeRequest<{ incident: CanonicalIncident }>(
    `/api/cad-bridge/conflicts/${encodeURIComponent(conflictId)}/resolve`,
    { method: "POST", body: JSON.stringify({ resolution, keepSlot }) },
  );
}

export function fetchCadBridgeAudit(rcIncidentId: string) {
  return cadBridgeRequest<{ items: BridgeAuditRecord[] }>(
    `/api/cad-bridge/audit?rcIncidentId=${encodeURIComponent(rcIncidentId)}`,
  );
}

export function testCadBridgeConnection(slot: "CAD_A" | "CAD_B") {
  return cadBridgeRequest<{
    ok: boolean;
    slot: string;
    vendor: string;
    mockMode: boolean;
    live: { attempted: boolean; ok: boolean };
  }>("/api/cad-bridge/test-connection", {
    method: "POST",
    body: JSON.stringify({ slot }),
  });
}

export function acceptCadBridgeTransfer(rcIncidentId: string) {
  return cadBridgeRequest<{ incident: CanonicalIncident }>(
    `/api/cad-bridge/incidents/${encodeURIComponent(rcIncidentId)}/transfer/accept`,
    { method: "POST", body: JSON.stringify({}) },
  );
}
