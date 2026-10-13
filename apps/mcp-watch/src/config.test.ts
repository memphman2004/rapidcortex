import { describe, expect, it } from "vitest";
import { ALLOWED_WATCHES, WRITE_SCOPE, loadConfig } from "./config.js";
import { WATCH_SIGNAL_WATCHES } from "rapid-cortex-shared";

describe("mcp-watch config", () => {
  it("defaults public origin to mcp.nexcortiq.us", () => {
    const cfg = loadConfig({
      WATCH_INGEST_BASE_URL: "https://api.example",
      RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN: "arn:secret:watch",
      MCP_JWT_SIGNING_SECRET_ARN: "arn:secret:jwt",
      MCP_OAUTH_STATE_TABLE: "oauth",
      COGNITO_USER_POOL_ID: "us-east-1_x",
      COGNITO_DOMAIN: "https://auth.example",
      COGNITO_CLIENT_ID: "client",
    });
    expect(cfg.publicBaseUrl).toBe("https://mcp.nexcortiq.us");
    expect(cfg.mcpIssuer).toBe("https://mcp.nexcortiq.us");
    expect(cfg.allowedHosts).toBe("mcp.nexcortiq.us");
    expect(WRITE_SCOPE).toBe("watch:write");
  });

  it("exposes exactly the five ChatGPT Watch categories from shared schema", () => {
    expect(ALLOWED_WATCHES).toEqual([
      "psap_intelligence",
      "campus_intelligence",
      "venue_intelligence",
      "transit_intelligence",
      "competitor_intelligence",
    ]);
    for (const w of ALLOWED_WATCHES) {
      expect(WATCH_SIGNAL_WATCHES).toContain(w);
    }
  });
});
