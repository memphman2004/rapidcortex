import { describe, expect, it } from "vitest";
import type { IntegrationStatusPayload } from "@/lib/api";
import {
  countIntegrationHealthErrors,
  integrationHealthRowsFromStatus,
} from "@/lib/integration-health-rows";

const basePayload: IntegrationStatusPayload = {
  agencyId: "agency-1",
  transcriptSource: {
    mode: "off",
    agencyEligible: true,
    connectorActive: false,
    fallback: "side_by_side",
  },
  auditHint: "test",
  pilotReadiness: {
    languageSessionsConfigured: true,
    multilingualStrictValidation: true,
    multilingualIssueCount: 0,
    multilingualPrimaryStt: "aws",
    multilingualPrimaryTranslation: "aws",
    multilingualPrimaryLanguageDetector: "aws",
    aiPrimaryProvider: "bedrock",
    aiSecondaryProvider: "openai",
    aiTertiaryProvider: "anthropic",
    assetsBucketConfigured: true,
  },
};

describe("integrationHealthRowsFromStatus", () => {
  it("maps transcript and pilot readiness into widget rows", () => {
    const rows = integrationHealthRowsFromStatus(basePayload);
    expect(rows[0]).toMatchObject({ name: "Transcript connector", status: "degraded" });
    expect(rows.some((r) => r.name === "Language sessions" && r.status === "connected")).toBe(true);
  });

  it("counts error and offline rows", () => {
    const payload: IntegrationStatusPayload = {
      ...basePayload,
      transcriptSource: {
        mode: "off",
        agencyEligible: false,
        connectorActive: false,
        fallback: "side_by_side",
      },
      pilotReadiness: {
        ...basePayload.pilotReadiness!,
        languageSessionsConfigured: false,
        assetsBucketConfigured: false,
      },
    };
    const rows = integrationHealthRowsFromStatus(payload);
    expect(countIntegrationHealthErrors(rows)).toBeGreaterThanOrEqual(2);
  });
});
