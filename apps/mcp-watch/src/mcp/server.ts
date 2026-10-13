import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpWatchConfig } from "../config.js";
import type { AuthPrincipal } from "../auth/authorize-write.js";
import { executeSubmitWatchSignal } from "./submit-watch-signal.js";

/**
 * Input schema mirrors WatchSignal fields for MCP tool discovery.
 * Runtime validation still uses watchSignalSchema from rapid-cortex-shared.
 */
const submitInputShape = {
  source: z.literal("chatgpt_watch"),
  watch: z.enum([
    "psap_intelligence",
    "campus_intelligence",
    "venue_intelligence",
    "transit_intelligence",
    "competitor_intelligence",
  ]),
  external_key: z.string().min(3).max(300),
  primary_vertical: z.string(),
  verticals: z.array(z.string()).min(1).max(12),
  agency: z.record(z.unknown()),
  signal: z.record(z.unknown()),
  opportunity: z.record(z.unknown()),
  funding: z.record(z.unknown()),
  competitors: z.array(z.unknown()).optional(),
  technologies: z.array(z.string()).optional(),
  pain_points: z.array(z.string()).optional(),
  matched_capabilities: z.array(z.string()).optional(),
  facts: z.array(z.string()).optional(),
  inferences: z.array(z.string()).optional(),
  contacts: z.array(z.unknown()).optional(),
  qualification: z.record(z.unknown()),
  next_action: z.string(),
  lifecycle: z.record(z.unknown()),
  evidence: z.array(z.record(z.unknown())).min(1),
  /** Optional: portal URL, document list, submission instructions, deadlines. */
  procurement_details: z.record(z.unknown()).optional(),
};

export type RequestAuthContext = {
  principal: AuthPrincipal | null;
};

/**
 * Create a fresh McpServer per request (stateless Lambda-safe).
 * Auth principal is closed over from the HTTP layer — never from tool args.
 */
export function createWatchMcpServer(
  config: McpWatchConfig,
  auth: RequestAuthContext,
): McpServer {
  const server = new McpServer({
    name: "nexcort-mcp-watch",
    version: "1.0.0",
  });

  server.registerTool(
    "submit_watch_signal",
    {
      title: "Submit Watch Signal",
      description:
        "Submit one canonical ChatGPT Watch intelligence signal to the NexCort iQ Watch Inbox. " +
        "Requires OAuth scope watch:write. Does not accept ingest API keys. " +
        "One signal per call; preserve external_key for dedupe across retries. " +
        "Required shape: source=chatgpt_watch; watch one of psap_intelligence|campus_intelligence|" +
        "venue_intelligence|transit_intelligence|competitor_intelligence; " +
        "agency.state 2-letter or null; opportunity.procurement_url must be a full https URL or null " +
        "(not empty string); funding amounts number|null; evidence[].source_quality one of " +
        "authoritative|strong|secondary|unverified; qualification.fit high|medium|low; " +
        "qualification.strategy direct|partner|monitor; competitors/technologies as string arrays. " +
        "Optional procurement_details: portal_url, portal_document_id, documents[{title,document_type,url," +
        "download_url?,access_type public|registration|paid}], submission_method, submission_instructions, " +
        "questions_deadline, prebid_conference, document_access_fee, notes. " +
        "Optional contact fields: department, organization, website, verification_source. " +
        "Never invent document URLs; only submit verified official links.",
      inputSchema: submitInputShape,
    },
    async (args) => {
      if (!auth.principal) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Unauthorized" }],
          structuredContent: { success: false, error: "UNAUTHORIZED" },
        };
      }
      return executeSubmitWatchSignal(args, auth.principal, config);
    },
  );

  return server;
}
