/**
 * Smoke the Multi-CAD Connector API (`/api/cad-connector/*`).
 * Requires ENABLE_CAD_CONNECTOR=true, cad.connector addon, and a bearer token.
 *
 *   CAD_CONNECTOR_SMOKE_BASE=https://host/api CAD_CONNECTOR_SMOKE_TOKEN=... npx tsx scripts/smoke-cad-connector.ts
 */
const BASE = (process.env.CAD_CONNECTOR_SMOKE_BASE ?? process.env.API_UPSTREAM_BASE_2 ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const TOKEN = process.env.CAD_CONNECTOR_SMOKE_TOKEN?.trim() ?? "";

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assertStatus(step: string, status: number, allowed: number[]): void {
  if (!allowed.includes(status)) {
    throw new Error(`${step}: expected ${allowed.join("/")} got ${status}`);
  }
}

async function main() {
  const list = await call("GET", "/api/cad-connector/connectors");
  assertStatus("GET connectors", list.status, [200, 401, 403, 503]);
  if (list.status !== 200) {
    console.log("[smoke-cad-connector] skipped remaining steps (auth/flag)", list.status, list.json);
    return;
  }

  const created = await call("POST", "/api/cad-connector/connectors", {
    vendorId: "motorola_premierone",
    displayName: "Smoke Law CAD",
    department: "law_enforcement",
    connectionMode: "polling",
    pollingIntervalSeconds: 60,
    baseUrl: "https://cad.example.invalid",
    authType: "api_key",
    apiKey: "smoke-key",
    enabled: false,
  });
  assertStatus("POST connectors", created.status, [201]);
  const connectorId = (created.json as { connector?: { connectorId?: string } }).connector?.connectorId;
  if (!connectorId) throw new Error("POST connectors missing connectorId");

  const health = await call("POST", `/api/cad-connector/connectors/${connectorId}/health-check`);
  assertStatus("health-check", health.status, [200]);

  const testFetch = await call("POST", `/api/cad-connector/connectors/${connectorId}/test-fetch`);
  assertStatus("test-fetch", testFetch.status, [200]);

  const incidents = await call("GET", "/api/cad-connector/incidents");
  assertStatus("GET incidents", incidents.status, [200]);

  const write = await call("POST", "/api/cad-connector/write-back", {
    unifiedId: "ucad_missing",
    payload: { action: "add_narrative", fields: {}, narrative: "smoke" },
  });
  assertStatus("POST write-back missing incident", write.status, [404, 201]);

  const audit = await call("GET", "/api/cad-connector/audit");
  assertStatus("GET audit", audit.status, [200, 403]);

  const del = await call("DELETE", `/api/cad-connector/connectors/${connectorId}`);
  assertStatus("DELETE connector", del.status, [200, 403]);

  console.log("[smoke-cad-connector] ok");
}

main().catch((error) => {
  console.error("[smoke-cad-connector] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
