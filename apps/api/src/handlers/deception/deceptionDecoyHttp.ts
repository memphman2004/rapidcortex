import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { assertDeceptionModuleIsolation } from "./assertDeceptionIsolation.js";
import { DECOY_RESPONSES } from "./fakeData.js";
import { persistDecoyRouteHit } from "./deceptionPersist.js";

assertDeceptionModuleIsolation();

const ROUTES = new Set([
  "/api/internal/cad-sync",
  "/api/internal/cad-writeback",
  "/api/internal/ncic-gateway",
  "/api/internal/agency-root",
  "/api/admin-backup",
  "/api/rc-lite/root",
  "/api/system/secrets",
  "/api/debug/env",
  "/api/v1/cad/export-test",
]);

function normalizePath(path: string): string {
  const p = path.split("?")[0] ?? path;
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (process.env.DECEPTION_SHIELD_ENABLED !== "true") {
    return json(404, { error: "Not found" });
  }

  const method = event.requestContext.http.method;
  const rawPath = normalizePath(event.rawPath ?? "");
  if (!ROUTES.has(rawPath)) {
    return json(404, { error: "Not found" });
  }

  const payload = DECOY_RESPONSES[rawPath as keyof typeof DECOY_RESPONSES];
  if (!payload) {
    return json(404, { error: "Not found" });
  }

  await persistDecoyRouteHit(event, rawPath, method);
  return json(200, payload);
};
