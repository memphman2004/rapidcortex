import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { getCurrentInvoke } from "@codegenie/serverless-express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authorizeWriteRequest } from "./auth/authorize-write.js";
import { loadConfig, type McpWatchConfig } from "./config.js";
import { lambdaBodyParser, localBodyParser } from "./http/parse-body.js";
import { createWatchMcpServer } from "./mcp/server.js";
import { registerOAuthRoutes } from "./oauth/routes.js";
import { auditLog } from "./security/audit.js";

function hostAllowed(hostHeader: string | undefined, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return true;
  const host = (hostHeader ?? "").split(":")[0]?.toLowerCase() ?? "";
  if (!host) return false;
  if (allowedHosts.some((h) => h.toLowerCase() === host)) return true;
  if (host.endsWith(".lambda-url.us-east-1.on.aws")) return true;
  if (host.endsWith(".cloudfront.net")) return true;
  return false;
}

export function createApp(
  config: McpWatchConfig = loadConfig(),
  opts?: { local?: boolean },
): Express {
  const allowedHosts = config.allowedHosts
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const app = express();
  // Disable Express's built-in query/body machinery that pulls in on-finished
  app.disable("x-powered-by");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!hostAllowed(req.headers.host, allowedHosts)) {
      res.status(421).json({ error: "invalid_host" });
      return;
    }
    next();
  });

  // Never use express.json / urlencoded on Lambda Function URL — they need req.on().
  if (opts?.local) {
    app.use(localBodyParser());
  } else {
    app.use(
      lambdaBodyParser(() => {
        try {
          return (getCurrentInvoke() as { event?: unknown } | undefined)?.event as
            | {
                body?: string | null;
                isBase64Encoded?: boolean;
                headers?: Record<string, string | undefined>;
              }
            | undefined;
        } catch {
          return undefined;
        }
      }),
    );
  }

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "nexcort-mcp-watch",
      stage: config.deploymentStage,
      issuer: config.mcpIssuer,
    });
  });

  registerOAuthRoutes(app, config);

  /**
   * Stateless Streamable HTTP: sessionIdGenerator undefined.
   * Fresh transport + McpServer per request — safe across Lambda invocations.
   */
  const handleMcp = async (req: Request, res: Response) => {
    const started = Date.now();
    const auth = await authorizeWriteRequest(req.header("authorization") ?? undefined, config);
    if (!auth.ok) {
      auditLog({
        event: "mcp_auth_denied",
        errorCode: auth.reason,
        status: auth.status,
        durationMs: Date.now() - started,
      });
      res.status(auth.status).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: auth.reason },
        id: null,
      });
      return;
    }

    const authCtx = { principal: auth.principal };
    const server = createWatchMcpServer(config, authCtx);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    const onClose =
      typeof (res as { on?: unknown }).on === "function"
        ? () => {
            void transport.close();
            void server.close();
          }
        : null;
    if (onClose) res.on("close", onClose);

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      auditLog({
        event: "mcp_request_ok",
        subject: auth.principal.subject,
        role: auth.principal.role,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      auditLog({
        event: "mcp_request_error",
        subject: auth.principal.subject,
        errorCode: err instanceof Error ? err.message : "mcp_error",
        durationMs: Date.now() - started,
      });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  app.post("/mcp", handleMcp);
  app.get("/mcp", handleMcp);
  app.delete("/mcp", handleMcp);

  return app;
}
