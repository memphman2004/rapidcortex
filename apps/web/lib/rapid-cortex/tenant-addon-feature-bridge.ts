import {
  ADDON_CATALOG,
  isAddonActiveForTenant,
  type AddonKey,
  type TenantEntitlements,
} from "rapid-cortex-shared";

/** Maps billing add-on keys to NexCort iQ feature registry ids used by `withFeatureContract`. */
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
  "ai.triage.basic": ["call_triage_workflows", "non_emergency_intake_queue"],
  "ai.triage.standard": ["call_triage_workflows", "non_emergency_intake_queue"],
  "ai.triage.premium": ["call_triage_workflows", "non_emergency_intake_queue"],
  "reliability.slo_dashboards": ["backlog_sla_tracking"],
  "caller_media.live_stream.basic": ["live_caller_media_streaming"],
  "caller_media.live_stream.standard": ["live_caller_media_streaming"],
  "caller_media.live_stream.premium": ["live_caller_media_streaming"],
  "caller_media.live_stream.enterprise": ["live_caller_media_streaming"],
  "caller_media.video_assist": ["video_assist", "live_caller_media_streaming"],
  "caller_media.live_video_kvs": ["live_video_kvs", "live_caller_media_streaming"],
  "vision.iq_vision": ["iq_vision"],
  "connect.nest": ["nest_connect"],
  "connect.wyze": ["wyze_connect"],
  "rc_video.wall": ["rc_video_wall"],
  "rc_video.ptz_gateway": ["rc_video_ptz_gateway", "rc_video_wall"],
  "milestone.xprotect": ["milestone_xprotect"],
  "feature_addons.rc_connect_standard": ["rc_video_wall"],
  "feature_addons.rc_connect_professional": ["rc_video_wall"],
  "feature_addons.rc_connect_enterprise": ["rc_video_wall"],
};

function mapAddonKeyToFeatureIds(key: AddonKey): string[] {
  const direct = ADDON_KEY_FEATURE_IDS[key];
  if (direct?.length) return direct;
  if (key.startsWith("translation.live.")) return ["live_translation"];
  if (key.startsWith("transcription.enhanced.") || key.startsWith("transcription.diarization.")) {
    return ["live_transcription"];
  }
  if (key.startsWith("ai.triage.")) {
    return ["call_triage_workflows", "non_emergency_intake_queue"];
  }
  if (key.startsWith("reliability.")) {
    return ["backlog_sla_tracking"];
  }
  if (key.startsWith("caller_media.live_stream.")) {
    return ["live_caller_media_streaming"];
  }
  if (key.startsWith("feature_addons.rc_connect_")) {
    return ["rc_video_wall"];
  }
  return [];
}

/**
 * Derives NexCort iQ `enabledAddOns` feature ids from tenant billing entitlements
 * (explicit toggles + plan-included SKUs).
 */
export function rapidCortexFeatureIdsFromTenantEntitlements(entitlements: TenantEntitlements): string[] {
  const out = new Set<string>();
  for (const def of ADDON_CATALOG) {
    const state = entitlements.addons[def.key];
    const active = isAddonActiveForTenant(def, entitlements.plan, state);
    if (!active) continue;
    for (const featureId of mapAddonKeyToFeatureIds(def.key)) {
      out.add(featureId);
    }
  }
  return [...out];
}
