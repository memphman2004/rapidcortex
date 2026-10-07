import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sanitizeForProvider } from "../sanitization.js";
import { evaluateProviderPolicy } from "../providerPolicy.js";

describe("sanitizeForProvider", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterEach(() => {
    logSpy.mockClear();
  });

  it("removes common PII while preserving transcript semantics", () => {
    const out = sanitizeForProvider({
      provider: "openai",
      agencyId: "test-agency",
      incidentId: "inc-123",
      content:
        "Officer Jane Smith met victim at 123 Main Street. SSN 123-45-6789. Call me at (555) 111-2222 or me@example.com. case #ABCD-1234",
    });

    expect(out.sanitizedContent).not.toContain("123-45-6789");
    expect(out.sanitizedContent).not.toContain("(555) 111-2222");
    expect(out.sanitizedContent).not.toContain("me@example.com");
    expect(out.sanitizedContent).not.toContain("123 Main Street");
    expect(out.sanitizedContent).toContain("[REDACTED_OFFICER_NAME]");
    expect(out.sanitizedContent).toContain("[REDACTED_TERM]");
    expect(out.metadata.totalRedactions).toBeGreaterThan(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("handles empty transcripts without false positives", () => {
    const out = sanitizeForProvider({
      provider: "anthropic",
      content: "",
    });
    expect(out.sanitizedContent).toBe("");
    expect(out.metadata.totalRedactions).toBe(0);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("handles all-redacted content", () => {
    const out = sanitizeForProvider({
      provider: "bedrock",
      content: "123-45-6789 (555) 111-2222 email@test.com",
    });
    expect(out.sanitizedContent).toContain("[REDACTED_SSN]");
    expect(out.sanitizedContent).toContain("[REDACTED_PHONE]");
    expect(out.sanitizedContent).toContain("[REDACTED_EMAIL]");
    expect(out.metadata.totalRedactions).toBeGreaterThanOrEqual(3);
  });
});

describe("provider policy enforcement", () => {
  it("blocks unauthorized providers from agency policy allowlist", () => {
    const decision = evaluateProviderPolicy({
      surface: "ai",
      provider: "openai",
      config: {
        agencyId: "agency-a",
        protocolPackId: "default",
        aiProviderProfileId: "default",
        retentionPolicyId: "ret-1",
        integrationMode: "none",
        transcriptRedactionEnabled: true,
        auditExportEnabled: false,
        environmentFlags: {
          aiProviderAllowlist: "bedrock",
        },
        supervisorEscalationRules: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("blocked");
  });

  it("enforces single-provider mode for high-sensitivity agencies", () => {
    const allowed = evaluateProviderPolicy({
      surface: "ai",
      provider: "bedrock",
      config: {
        agencyId: "agency-b",
        protocolPackId: "default",
        aiProviderProfileId: "default",
        retentionPolicyId: "ret-1",
        integrationMode: "none",
        transcriptRedactionEnabled: true,
        auditExportEnabled: false,
        environmentFlags: {
          aiProviderAllowlist: "bedrock,openai",
          aiSingleProviderMode: true,
          aiSingleProvider: "bedrock",
        },
        supervisorEscalationRules: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    const blocked = evaluateProviderPolicy({
      surface: "ai",
      provider: "openai",
      config: {
        agencyId: "agency-b",
        protocolPackId: "default",
        aiProviderProfileId: "default",
        retentionPolicyId: "ret-1",
        integrationMode: "none",
        transcriptRedactionEnabled: true,
        auditExportEnabled: false,
        environmentFlags: {
          aiProviderAllowlist: "bedrock,openai",
          aiSingleProviderMode: true,
          aiSingleProvider: "bedrock",
        },
        supervisorEscalationRules: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(allowed.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
  });
});
