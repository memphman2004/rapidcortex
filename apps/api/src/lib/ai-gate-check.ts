/**
 * Authoritative Lambda-side AI gate check.
 * Frontend gating is UX only — always call this before Bedrock/Rekognition/Transcribe.
 */

import type { AIGateFeatureKey } from "rapid-cortex-shared";
import { isAIGateFeatureOn } from "rapid-cortex-shared";
import { AIGateRepository } from "../repositories/aiGateRepository.js";
import { env } from "./env.js";

const repo = new AIGateRepository();

/** In-process cache (warm Lambda) — ~60s TTL per agency. */
const cache = new Map<string, { at: number; enabled: boolean }>();
const CACHE_MS = 60_000;

export async function assertAIGateFeature(
  agencyId: string,
  feature: AIGateFeatureKey,
): Promise<{ allowed: boolean; aiDisabled: boolean }> {
  if (!env.enableAiFeatureGate) {
    return { allowed: true, aiDisabled: false };
  }
  if (!env.agencyAiGateTable) {
    // Table not provisioned yet — default-on (invariant #9).
    return { allowed: true, aiDisabled: false };
  }

  const key = `${agencyId}:${feature}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { allowed: hit.enabled, aiDisabled: !hit.enabled };
  }

  try {
    const config = await repo.getConfig(agencyId);
    const allowed = isAIGateFeatureOn(config, feature);
    cache.set(key, { at: Date.now(), enabled: allowed });
    return { allowed, aiDisabled: !allowed };
  } catch (err) {
    console.error(JSON.stringify({ msg: "ai_gate_check_error", agencyId, feature, error: String(err) }));
    // Fail open to default-on so a misconfigured table does not block ops.
    return { allowed: true, aiDisabled: false };
  }
}
