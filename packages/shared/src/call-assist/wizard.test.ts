import { describe, expect, it } from "vitest";
import {
  CALL_ASSIST_CAD_WIZARD_OPTIONS,
  cadWizardSelection,
  clampEmergencyThreshold,
  DEFAULT_DISCLOSURE_BY_VERTICAL,
  isCallAssistOnboardingComplete,
  normalizeConfidenceThresholds,
  presetTaxonomy,
  resolveCadPushLabel,
  substituteAgencyShortName,
  TAXONOMY_PRESETS,
} from "./index.js";
import { callAssistAdminConfigPatchSchema } from "./schemas.js";

describe("Call Assist onboarding helpers", () => {
  it("vertical selection loads the matching taxonomy preset", () => {
    expect(presetTaxonomy("campus").callTypes.some((t) => t.id === "wellness_check")).toBe(true);
    expect(presetTaxonomy("911").callTypes.some((t) => t.id === "ANIMAL_CONTROL")).toBe(true);
    expect(TAXONOMY_PRESETS.venue.callTypes.some((t) => t.id === "lost_person")).toBe(true);
  });

  it("CAD provider None hides CAD push in session detail", () => {
    const none = CALL_ASSIST_CAD_WIZARD_OPTIONS.find((o) => o.id === "none");
    expect(none?.cadProviderLabel).toBeNull();
    expect(resolveCadPushLabel(none?.cadProviderId, none?.cadProviderLabel ?? null)).toBeNull();
    expect(cadWizardSelection("mock", null).id).toBe("none");
  });

  it("disclosure text substitutes {agencyShortName}", () => {
    const text = substituteAgencyShortName(DEFAULT_DISCLOSURE_BY_VERTICAL.campus, "State U");
    expect(text).toContain("State U");
    expect(text).not.toContain("{agencyShortName}");
  });

  it("confidence thresholds reject values outside 0.50–0.90 for emergency", () => {
    expect(clampEmergencyThreshold(0.2)).toBe(0.5);
    expect(clampEmergencyThreshold(0.99)).toBe(0.9);
    expect(normalizeConfidenceThresholds({ emergency: 0.4 }).emergency).toBe(0.5);
    expect(callAssistAdminConfigPatchSchema.safeParse({ confidenceThresholds: { emergency: 0.4 } }).success).toBe(
      false,
    );
    expect(callAssistAdminConfigPatchSchema.safeParse({ confidenceThresholds: { emergency: 0.7 } }).success).toBe(
      true,
    );
  });

  it("onboardingComplete=false is incomplete; missing field grandfathers existing tenants", () => {
    expect(isCallAssistOnboardingComplete({ onboardingComplete: false })).toBe(false);
    expect(isCallAssistOnboardingComplete({ onboardingComplete: true })).toBe(true);
    expect(isCallAssistOnboardingComplete({})).toBe(true);
  });

  it("each wizard step can save independently via partial PATCH", () => {
    expect(callAssistAdminConfigPatchSchema.safeParse({ vertical: "campus" }).success).toBe(true);
    expect(callAssistAdminConfigPatchSchema.safeParse({ agencyShortName: "StateU" }).success).toBe(true);
    expect(callAssistAdminConfigPatchSchema.safeParse({ disclosureText: "Hello" }).success).toBe(true);
    expect(
      callAssistAdminConfigPatchSchema.safeParse({
        onboardingComplete: true,
        onboardingCompletedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});
