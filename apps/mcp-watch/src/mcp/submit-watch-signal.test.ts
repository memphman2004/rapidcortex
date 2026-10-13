import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSubmitWatchSignal } from "./submit-watch-signal.js";
import type { McpWatchConfig } from "../config.js";
import type { AuthPrincipal } from "../auth/authorize-write.js";
import { ALLOWED_WATCHES } from "../config.js";

vi.mock("../oauth/store.js", () => ({
  checkAndIncrementRateLimit: vi.fn(async () => ({ allowed: true, remaining: 100 })),
}));

vi.mock("../secrets/watch-ingest-key.js", () => ({
  getWatchIngestApiKey: vi.fn(async () => "test-ingest-key"),
}));

const postWatchIngest = vi.fn();
vi.mock("../upstream/watch-ingest-client.js", () => ({
  postWatchIngest: (...args: unknown[]) => postWatchIngest(...args),
}));

const principal: AuthPrincipal = {
  subject: "user-1",
  role: "rcadmin",
  scopes: ["watch:write"],
};

const config: McpWatchConfig = {
  deploymentStage: "dev",
  publicBaseUrl: "https://mcp.nexcortiq.us",
  watchIngestBaseUrl: "https://api.example",
  watchIngestApiKeySecretArn: "arn:secret:watch",
  mcpJwtSigningSecretArn: "arn:secret:jwt",
  oauthStateTableName: "oauth-table",
  cognitoUserPoolId: "us-east-1_x",
  cognitoDomain: "https://auth.example",
  cognitoClientId: "client",
  cognitoRegion: "us-east-1",
  mcpAudience: "nexcort-mcp-watch",
  mcpIssuer: "https://mcp.nexcortiq.us",
  allowedHosts: "mcp.nexcortiq.us",
  rateLimitPerHour: 120,
  upstreamMaxAttempts: 3,
};

function validSignal(watch: string) {
  return {
    source: "chatgpt_watch",
    watch,
    external_key: `TEST|${watch}|1`,
    primary_vertical: "psap",
    verticals: ["psap"],
    agency: {
      name: "Test Agency",
      department: null,
      city: "Austin",
      state: "TX",
      country: "US",
    },
    signal: {
      type: "procurement",
      category: "CAD",
      strength: "moderate",
      buying_stage: "planning",
      event_date: null,
      title: "Test signal",
    },
    opportunity: {
      solicitation_number: null,
      posted_date: null,
      due_date: null,
      status: "open",
      procurement_url: "https://example.gov/rfp",
    },
    funding: {
      estimated_contract_value: null,
      project_budget: null,
      grant_amount: null,
      annual_support: null,
      funding_source: null,
    },
    competitors: [],
    technologies: [],
    pain_points: [],
    matched_capabilities: [],
    facts: ["fact"],
    inferences: ["inference"],
    contacts: [],
    qualification: { fit: "medium", strategy: "monitor", reason: "test" },
    next_action: "Review",
    lifecycle: { change_type: "new", summary: "new" },
    evidence: [
      {
        url: "https://example.gov/rfp",
        source_type: "rfp",
        source_quality: "strong",
        document_title: "RFP",
        page: null,
        meeting_date: null,
      },
    ],
  };
}

describe("executeSubmitWatchSignal", () => {
  beforeEach(() => {
    postWatchIngest.mockReset();
  });

  it("rejects invalid JSON shape", async () => {
    const r = await executeSubmitWatchSignal({ watch: "nope" }, principal, config);
    expect(r.isError).toBe(true);
    expect(r.structuredContent?.error).toBe("VALIDATION_ERROR");
    expect(postWatchIngest).not.toHaveBeenCalled();
  });

  it.each([...ALLOWED_WATCHES])("accepts watch category %s", async (watch) => {
    postWatchIngest.mockResolvedValue({
      success: true,
      action: "created",
      signal_id: "s1",
      external_key: `TEST|${watch}|1`,
      lifecycle_event_created: true,
    });
    const r = await executeSubmitWatchSignal(validSignal(watch), principal, config);
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent?.success).toBe(true);
    expect(postWatchIngest).toHaveBeenCalledTimes(1);
    const sent = postWatchIngest.mock.calls[0]![0] as { external_key: string; watch: string };
    expect(sent.watch).toBe(watch);
    expect(sent.external_key).toBe(`TEST|${watch}|1`);
  });

  it("rejects cross_vertical (not in five MCP watches)", async () => {
    const r = await executeSubmitWatchSignal(validSignal("cross_vertical"), principal, config);
    expect(r.isError).toBe(true);
    expect(postWatchIngest).not.toHaveBeenCalled();
  });

  it("surfaces upstream duplicate/unchanged without exposing api key", async () => {
    postWatchIngest.mockResolvedValue({
      success: true,
      action: "unchanged",
      signal_id: "s1",
      external_key: "TEST|psap_intelligence|1",
      lifecycle_event_created: false,
      possible_duplicate: true,
      possible_duplicate_of: "s0",
    });
    const r = await executeSubmitWatchSignal(validSignal("psap_intelligence"), principal, config);
    expect(r.structuredContent?.action).toBe("unchanged");
    const blob = JSON.stringify(r);
    expect(blob).not.toMatch(/test-ingest-key/);
    expect(blob).not.toMatch(/apiKey|x-nexcort-watch-key/i);
  });
});
