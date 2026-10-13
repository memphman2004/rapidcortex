import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authorizeWriteRequest } from "./auth/authorize-write.js";
import { loadConfig } from "./config.js";
import {
  fromWebResponse,
  getHeader,
  getMethod,
  getPath,
  getQuery,
  jsonResult,
  parseBody,
  toWebRequest,
  type LambdaHttpEvent,
  type LambdaHttpResult,
} from "./http/lambda-http.js";
import { createWatchMcpServer } from "./mcp/server.js";
import { handleOAuthRoute } from "./oauth/handlers.js";
import { auditLog } from "./security/audit.js";

/**
 * Pure Function URL handler — no Express / serverless-express.
 * MCP uses WebStandard transport with enableJsonResponse so BUFFERED
 * Lambda Function URLs (and CloudFront) return complete JSON, not hanging SSE.
 */
export async function handler(event: LambdaHttpEvent): Promise<LambdaHttpResult> {
  const config = loadConfig();
  const method = getMethod(event);
  const path = getPath(event);
  const host = getHeader(event, "host") ?? "";

  const allowed = config.allowedHosts.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const hostOk =
    allowed.length === 0 ||
    allowed.includes(host.split(":")[0]?.toLowerCase() ?? "") ||
    host.endsWith(".lambda-url.us-east-1.on.aws") ||
    host.endsWith(".cloudfront.net");
  if (!hostOk) {
    return jsonResult(421, { error: "invalid_host" });
  }

  if (method === "GET" && path === "/health") {
    return jsonResult(200, {
      ok: true,
      service: "nexcort-mcp-watch",
      stage: config.deploymentStage,
      issuer: config.mcpIssuer,
    });
  }

  const oauth = await handleOAuthRoute(config, {
    method,
    path,
    query: getQuery(event),
    body: parseBody(event),
  });
  if (oauth) return oauth;

  if (path === "/mcp") {
    return handleMcp(event, config);
  }

  return jsonResult(404, { error: "not_found" });
}

async function handleMcp(
  event: LambdaHttpEvent,
  config: ReturnType<typeof loadConfig>,
): Promise<LambdaHttpResult> {
  const started = Date.now();
  const auth = await authorizeWriteRequest(getHeader(event, "authorization"), config);
  if (!auth.ok) {
    auditLog({
      event: "mcp_auth_denied",
      errorCode: auth.reason,
      status: auth.status,
      durationMs: Date.now() - started,
    });
    return jsonResult(auth.status, {
      jsonrpc: "2.0",
      error: { code: -32001, message: auth.reason },
      id: null,
    });
  }

  const authCtx = { principal: auth.principal };
  const server = createWatchMcpServer(config, authCtx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Critical for Lambda Function URL BUFFERED + CloudFront: no open SSE.
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const request = toWebRequest(event, config.publicBaseUrl);
    const parsedBody = parseBody(event);
    const response = await transport.handleRequest(request, { parsedBody });
    auditLog({
      event: "mcp_request_ok",
      subject: auth.principal.subject,
      role: auth.principal.role,
      durationMs: Date.now() - started,
    });
    return fromWebResponse(response);
  } catch (err) {
    auditLog({
      event: "mcp_request_error",
      subject: auth.principal.subject,
      errorCode: err instanceof Error ? err.message : "mcp_error",
      durationMs: Date.now() - started,
    });
    return jsonResult(500, {
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: null,
    });
  } finally {
    void transport.close();
    void server.close();
  }
}
