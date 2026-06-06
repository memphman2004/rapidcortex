import {
  ADDON_CATALOG,
  isAddonIncludedInPlan,
  type AddonKey,
  type TenantEntitlements,
} from "rapid-cortex-shared";

/** Maps billing add-on keys to Rapid Cortex feature registry ids used by `withFeatureContract`. */
const ADDON_KEY_FEATURE_IDS: Partial<Record<AddonKey, string[]>> = {
  "translation.live.tier1": ["live_translation"],
  "translation.live.tier2": ["live_translation"],
  "translation.live.tier3": ["live_translation"],
  "translation.live.tier4": ["live_translation"],
  "translation.text_to_voice": ["text_to_voice_support"],
  "translation.custom_language": ["multilingual_intake", "language_auto_detection"],
  "translation.audit_trail": ["live_translation"],
  "transcription.enhanced.tier1": ["live_transcription"],
  "transcription.enhanced.tier2": ["live_transcription"],
  "transcription.enhanced.tier3": ["live_transcription"],
  "transcription.diarization.tier1": ["live_transcription"],
  "transcription.diarization.tier2": ["live_transcription"],
  "transcription.diarization.tier3": ["live_transcription"],
};

function mapAddonKeyToFeatureIds(key: AddonKey): string[] {
  const direct = ADDON_KEY_FEATURE_IDS[key];
  if (direct?.length) return direct;
  if (key.startsWith("translation.live.")) return ["live_translation"];
  if (key.startsWith("transcription.enhanced.") || key.startsWith("transcription.diarization.")) {
    return ["live_transcription"];
  }
  return [];
}

/**
 * Derives Rapid Cortex `enabledAddOns` feature ids from tenant billing entitlements
 * (explicit toggles + plan-included SKUs).
 */
export function rapidCortexFeatureIdsFromTenantEntitlements(entitlements: TenantEntitlements): string[] {
  const out = new Set<string>();
  for (const def of ADDON_CATALOG) {
    const state = entitlements.addons[def.key];
    const active = Boolean(state?.enabled) || isAddonIncludedInPlan(def, entitlements.plan);
    if (!active) continue;
    for (const featureId of mapAddonKeyToFeatureIds(def.key)) {
      out.add(featureId);
    }
  }
  return [...out];
}
