import type {
  CadConnectorConfig,
  CadFieldMapping,
  CadHealthCheckResult,
  CadRoutingRule,
  CadWriteBackRequest,
  UnifiedCadIncident,
} from "rapid-cortex-shared";

async function cadFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/cad-connector${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = body && typeof body === "object" && "error" in body ? String((body as { error: string }).error) : `Request failed ${res.status}`;
    throw new Error(err);
  }
  return body as T;
}

export type CadStatusItem = {
  connectorId: string;
  displayName: string;
  department: string;
  vendorId: string;
  enabled: boolean;
  lastHealthCheck?: CadHealthCheckResult;
  lastSyncAt?: string;
};

export async function fetchCadStatus(): Promise<CadStatusItem[]> {
  const data = await cadFetch<{ items: CadStatusItem[] }>("/status");
  return data.items;
}

export async function fetchCadConnectors(): Promise<CadConnectorConfig[]> {
  const data = await cadFetch<{ items: CadConnectorConfig[] }>("/connectors");
  return data.items;
}

export async function createCadConnector(body: Record<string, unknown>): Promise<CadConnectorConfig> {
  const data = await cadFetch<{ connector: CadConnectorConfig }>("/connectors", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.connector;
}

export async function updateCadConnector(connectorId: string, body: Record<string, unknown>): Promise<CadConnectorConfig> {
  const data = await cadFetch<{ connector: CadConnectorConfig }>(`/connectors/${encodeURIComponent(connectorId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.connector;
}

export async function deleteCadConnector(connectorId: string): Promise<void> {
  await cadFetch(`/connectors/${encodeURIComponent(connectorId)}`, { method: "DELETE" });
}

export async function setCadConnectorEnabled(connectorId: string, enabled: boolean): Promise<CadConnectorConfig> {
  const action = enabled ? "enable" : "disable";
  const data = await cadFetch<{ connector: CadConnectorConfig }>(
    `/connectors/${encodeURIComponent(connectorId)}/${action}`,
    { method: "POST" },
  );
  return data.connector;
}

export async function testCadConnectorHealth(connectorId: string): Promise<CadHealthCheckResult> {
  const data = await cadFetch<{ health: CadHealthCheckResult }>(
    `/connectors/${encodeURIComponent(connectorId)}/health-check`,
    { method: "POST" },
  );
  return data.health;
}

export async function testCadConnectorFetch(connectorId: string): Promise<{
  incidents: UnifiedCadIncident[];
  errors: Array<{ field: string; message: string }>;
}> {
  return cadFetch(`/connectors/${encodeURIComponent(connectorId)}/test-fetch`, { method: "POST" });
}

export async function fetchCadMappings(connectorId: string): Promise<CadFieldMapping[]> {
  const data = await cadFetch<{ mappings: CadFieldMapping[] }>(
    `/connectors/${encodeURIComponent(connectorId)}/mappings`,
  );
  return data.mappings;
}

export async function putCadMappings(connectorId: string, mappings: CadFieldMapping[]): Promise<CadFieldMapping[]> {
  const data = await cadFetch<{ mappings: CadFieldMapping[] }>(
    `/connectors/${encodeURIComponent(connectorId)}/mappings`,
    { method: "PUT", body: JSON.stringify({ mappings }) },
  );
  return data.mappings;
}

export async function fetchCadRoutingRules(): Promise<CadRoutingRule[]> {
  const data = await cadFetch<{ rules: CadRoutingRule[] }>("/routing-rules");
  return data.rules;
}

export async function putCadRoutingRules(rules: CadRoutingRule[]): Promise<CadRoutingRule[]> {
  const data = await cadFetch<{ rules: CadRoutingRule[] }>("/routing-rules", {
    method: "PUT",
    body: JSON.stringify({ rules }),
  });
  return data.rules;
}

export async function fetchCadIncidents(query = ""): Promise<UnifiedCadIncident[]> {
  const data = await cadFetch<{ items: UnifiedCadIncident[] }>(`/incidents${query}`);
  return data.items;
}

export async function fetchCadIncident(unifiedId: string): Promise<UnifiedCadIncident> {
  const data = await cadFetch<{ incident: UnifiedCadIncident }>(`/incidents/${encodeURIComponent(unifiedId)}`);
  return data.incident;
}

export async function fetchCadDuplicates(unifiedId: string): Promise<UnifiedCadIncident[]> {
  const data = await cadFetch<{ items: UnifiedCadIncident[] }>(
    `/incidents/${encodeURIComponent(unifiedId)}/duplicates`,
  );
  return data.items;
}

export async function submitCadWriteBack(body: {
  unifiedId: string;
  payload: CadWriteBackRequest["payload"];
}): Promise<CadWriteBackRequest> {
  const data = await cadFetch<{ writeBack: CadWriteBackRequest }>("/write-back", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.writeBack;
}

export async function fetchCadWriteBacks(query = ""): Promise<CadWriteBackRequest[]> {
  const data = await cadFetch<{ items: CadWriteBackRequest[] }>(`/write-back${query}`);
  return data.items;
}

export async function approveCadWriteBack(
  writeBackId: string,
  body: { overrideUnhealthy?: boolean; justification?: string } = {},
): Promise<CadWriteBackRequest> {
  const data = await cadFetch<{ writeBack: CadWriteBackRequest }>(
    `/write-back/${encodeURIComponent(writeBackId)}/approve`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.writeBack;
}

export async function rejectCadWriteBack(writeBackId: string, reason: string): Promise<CadWriteBackRequest> {
  const data = await cadFetch<{ writeBack: CadWriteBackRequest }>(
    `/write-back/${encodeURIComponent(writeBackId)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  return data.writeBack;
}

export async function fetchCadConnectorAudit(): Promise<Array<Record<string, unknown>>> {
  const data = await cadFetch<{ items: Array<Record<string, unknown>> }>("/audit");
  return data.items;
}
