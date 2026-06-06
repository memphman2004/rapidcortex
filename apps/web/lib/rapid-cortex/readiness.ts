import { RAPID_CORTEX_FEATURES, type RapidCortexFeature, type RapidCortexPlan } from "@/lib/rapid-cortex/features";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";
import { isFeatureEnabledForAgency, getFeatureAvailability } from "@/lib/rapid-cortex/entitlements";

export type ReadinessState = "ready" | "configuration_required" | "blocked" | "disabled" | "addon_not_enabled";

export type FeatureReadinessResult = {
  featureId: string;
  label: string;
  shortDescription: string;
  state: ReadinessState;
  missing: string[];
  nextAction: string;
};

const CAD_ENV = [
  "CAD_INTEGRATION_MODE",
  "CAD_API_BASE_URL",
  "CAD_AUTH_TYPE",
  "CAD_API_KEY_SECRET_ARN",
] as const;

function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function resolveAiEnv(): { ok: boolean; missing: string[] } {
  const need = ["PRIMARY_PROVIDER"];
  const m = need.filter((k) => !hasEnv(k));
  return { ok: m.length === 0, missing: m };
}

function resolveTranscriptionEnv(): { ok: boolean; missing: string[] } {
  return { ok: hasEnv("SPEECH_REGION") || hasEnv("TRANSCRIPTION_PROVIDER"), missing: hasEnv("SPEECH_REGION") || hasEnv("TRANSCRIPTION_PROVIDER") ? [] : ["SPEECH_REGION or TRANSCRIPTION_PROVIDER"] };
}

function resolveTranslationEnv(): { ok: boolean; missing: string[] } {
  return { ok: hasEnv("LANGUAGE_PROVIDER"), missing: hasEnv("LANGUAGE_PROVIDER") ? [] : ["LANGUAGE_PROVIDER"] };
}

function resolveCadConfig(): { ok: boolean; missing: string[] } {
  const mode = (process.env.CAD_INTEGRATION_MODE ?? "disabled").toLowerCase();
  if (mode === "disabled") {
    return { ok: true, missing: [] };
  }
  const m = (CAD_ENV as readonly string[]).filter((k) => !hasEnv(k));
  return { ok: m.length === 0, missing: m };
}

export function getFeatureReadiness(
  feature: RapidCortexFeature,
  plan: RapidCortexPlan,
  agencyConfig: AgencyFeatureConfig,
): FeatureReadinessResult {
  const availability = getFeatureAvailability(plan, feature.id);
  const missing: string[] = [];
  if (feature.requiresSecrets) {
    if (feature.id.includes("cad") || feature.category === "cad_integration") {
      const c = resolveCadConfig();
      if (!c.ok) missing.push(...c.missing.map((x) => `env:${x}`));
    }
    if (feature.category === "ai_call_intelligence" || feature.id === "ai_assisted_intake") {
      const a = resolveAiEnv();
      if (!a.ok) missing.push(...a.missing.map((x) => `env:${x}`));
    }
    if (feature.id === "live_transcription") {
      const t = resolveTranscriptionEnv();
      if (!t.ok) missing.push(...t.missing.map((x) => `env:${x}`));
    }
    if (feature.category === "language_communication") {
      const tr = resolveTranslationEnv();
      if (!tr.ok) missing.push(...tr.missing.map((x) => `env:${x}`));
    }
  }

  if (availability === "unavailable") {
    return {
      featureId: feature.id,
      label: feature.label,
      shortDescription: feature.shortDescription,
      state: "blocked",
      missing,
      nextAction: "Upgrade plan or use a feature included in your tier.",
    };
  }
  if (availability === "add_on" && !agencyConfig.enabledAddOns.includes(feature.id)) {
    return {
      featureId: feature.id,
      label: feature.label,
      shortDescription: feature.shortDescription,
      state: "addon_not_enabled",
      missing,
      nextAction: "Contact Support to add this module to your contract and enable the add-on flag.",
    };
  }
  if (agencyConfig.disabledFeatures.includes(feature.id)) {
    return {
      featureId: feature.id,
      label: feature.label,
      shortDescription: feature.shortDescription,
      state: "disabled",
      missing,
      nextAction: "Agency admin can re-enable this in admin features if policy allows.",
    };
  }
  if (!isFeatureEnabledForAgency(agencyConfig, feature.id)) {
    return {
      featureId: feature.id,
      label: feature.label,
      shortDescription: feature.shortDescription,
      state: "configuration_required",
      missing: [...missing, "entitlement:feature gate"],
      nextAction: "Complete agency approvals, add-ons, or audit settings required for this feature.",
    };
  }
  if (missing.length > 0) {
    return {
      featureId: feature.id,
      label: feature.label,
      shortDescription: feature.shortDescription,
      state: "configuration_required",
      missing,
      nextAction: "Set the listed environment variables or secrets, then re-check readiness.",
    };
  }
  return {
    featureId: feature.id,
    label: feature.label,
    shortDescription: feature.shortDescription,
    state: "ready",
    missing: [],
    nextAction: "No blocking configuration detected for this environment snapshot.",
  };
}

export function getAllFeatureReadiness(
  plan: RapidCortexPlan,
  agencyConfig: AgencyFeatureConfig,
): FeatureReadinessResult[] {
  return RAPID_CORTEX_FEATURES.map((f) => getFeatureReadiness(f, plan, agencyConfig));
}
