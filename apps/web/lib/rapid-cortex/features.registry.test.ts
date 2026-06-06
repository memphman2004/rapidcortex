import { describe, expect, it } from "vitest";
import { RAPID_CORTEX_FEATURES, type RapidCortexPlan } from "./features";
import { FEATURE_NARRATIVES } from "./feature-narratives.data";
import { PRICING_COMPARISON_ROW_FEATURE_IDS } from "../marketing/pricing-comparison-feature-ids";
import { isFeatureEnabledForAgency } from "./entitlements";
import type { AgencyFeatureConfig } from "./entitlements";

const PLANS: RapidCortexPlan[] = ["essential", "professional", "command", "enterprise"];

describe("feature registry integrity", () => {
  it("has explicit narratives for every feature id", () => {
    for (const f of RAPID_CORTEX_FEATURES) {
      expect(FEATURE_NARRATIVES[f.id], `narrative for ${f.id}`).toBeDefined();
    }
  });

  it("has no duplicate feature ids", () => {
    const seen = new Set<string>();
    for (const f of RAPID_CORTEX_FEATURES) {
      expect(seen.has(f.id), `duplicate ${f.id}`).toBe(false);
      seen.add(f.id);
    }
  });

  it("includes every plan key on every feature", () => {
    for (const f of RAPID_CORTEX_FEATURES) {
      for (const p of PLANS) {
        expect(f.planAvailability[p], f.id).toBeDefined();
      }
    }
  });

  it("requires backend features list api or env per policy", () => {
    for (const f of RAPID_CORTEX_FEATURES) {
      if (f.requiresBackend) {
        const hasApi = f.apiEndpoints && f.apiEndpoints.length > 0;
        const note = f.rolloutNotes?.toLowerCase() ?? "";
        const hasNote =
          note.includes("stub") ||
          note.includes("501") ||
          note.includes("contract") ||
          note.includes("packaging") ||
          note.includes("auth") ||
          note.includes("policy") ||
          note.includes("deployment") ||
          note.includes("rollout") ||
          note.includes("credential") ||
          note.includes("kms") ||
          note.includes("integration") ||
          note.includes("sensitive") ||
          note.includes("cloudwatch") ||
          (f.routePath != null && f.routePath.length > 0);
        expect(
          hasApi ||
            hasNote ||
            f.category === "deployment_support" ||
            f.category === "support" ||
            f.category === "core_platform" ||
            f.category === "cad_integration" ||
            f.category === "security_compliance",
          `${f.id}: requiresBackend should have apiEndpoints or rollout note`,
        ).toBe(true);
      }
      if (f.requiresSecrets) {
        const rn = f.rolloutNotes.toLowerCase();
        const hasEnvName = (f.envVars?.length ?? 0) > 0;
        const hasRolloutHint =
          rn.includes("secret") ||
          rn.includes("credential") ||
          rn.includes("provider") ||
          rn.includes("integration") ||
          rn.includes("external") ||
          rn.includes("assist") ||
          rn.includes("policy");
        const reliabilityApi =
          f.category === "reliability_technical_operations" &&
          f.apiEndpoints &&
          f.apiEndpoints.length > 0;
        expect(
          hasEnvName || hasRolloutHint || reliabilityApi,
          `${f.id}: requiresSecrets should name env, hint in rollout, or list reliability API`,
        ).toBe(true);
      }
    }
  });

  it("does not default automated CAD write-back to an enabled product state", () => {
    const f = RAPID_CORTEX_FEATURES.find((x) => x.id === "cad_automated_writeback");
    expect(f?.defaultEnabled).toBe(false);
  });

  it("maps public pricing rows to registry ids", () => {
    for (const [label, id] of Object.entries(PRICING_COMPARISON_ROW_FEATURE_IDS)) {
      const found = RAPID_CORTEX_FEATURES.find((f) => f.id === id);
      expect(found, `${label} -> ${id}`).toBeDefined();
    }
  });
});

const ecBase: AgencyFeatureConfig = {
  agencyId: "a1",
  plan: "professional",
  enabledAddOns: [],
  limitedFeatureOverrides: [],
  disabledFeatures: [],
  cadIntegrationMode: "disabled",
  writeBackEnabled: false,
  agencyApprovalGranted: false,
  agencyApprovedCadWriteBack: false,
  auditLoggingEnabled: true,
};

describe("entitlement rules", () => {
  it("blocks add-on without enabledAddOns", () => {
    expect(
      isFeatureEnabledForAgency(
        { ...ecBase, plan: "essential" },
        "live_translation",
      ),
    ).toBe(false);
  });

  it("enables add-on with flag", () => {
    expect(
      isFeatureEnabledForAgency(
        { ...ecBase, plan: "essential", enabledAddOns: ["live_translation"] },
        "live_translation",
      ),
    ).toBe(true);
  });

  it("blocks automated cad writeback by default", () => {
    expect(
      isFeatureEnabledForAgency(
        {
          ...ecBase,
          plan: "enterprise",
          cadIntegrationMode: "automated_writeback",
          writeBackEnabled: true,
          agencyApprovalGranted: true,
          agencyApprovedCadWriteBack: true,
        },
        "cad_automated_writeback",
      ),
    ).toBe(false);
  });
});
