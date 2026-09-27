/**
 * AI Feature Gate — shared types consumed by API and web.
 * All AI-powered features are gated through this single config record.
 *
 * TRANSFER_911 and RCS safety paths are NEVER gated here — those are
 * hardcoded deterministic per engineering-decisions.md.
 */

export const AI_GATE_FEATURES = [
  "callHandling",
  "incidentSuggestions",
  "priorityScoring",
  "transcription",
  "summaries",
  "cameraAnalysis",
  "translation",
  "patternDetection",
] as const;

export type AIGateFeatureKey = (typeof AI_GATE_FEATURES)[number];

export type AIGateFeatureMap = Record<AIGateFeatureKey, boolean>;

export interface AIGateConfig {
  agencyId: string;
  /** Master switch — false forces all features off */
  aiEnabled: boolean;
  features: AIGateFeatureMap;
  toggledAt: string;
  toggledBy: string;
  toggleReason: string | null;
}

export interface AIGateAuditRecord {
  agencyId: string;
  auditedAt: string;
  auditedBy: string;
  auditedByDisplay: string;
  action: "AI_ENABLED" | "AI_DISABLED" | "FEATURE_CHANGED";
  previousState: AIGateFeatureMap & { aiEnabled: boolean };
  newState: AIGateFeatureMap & { aiEnabled: boolean };
  reason: string | null;
}

/** HTTP request body for PUT /api/agency/{agencyId}/config/ai-mode */
export interface AIGateToggleRequest {
  enabled: boolean;
  reason?: string;
  /** Optional — override individual features. Master `enabled=false` forces all off. */
  features?: Partial<AIGateFeatureMap>;
}

/** WebSocket push — use `{ type, data }` envelope so web clients parse consistently. */
export interface AIGateModeChangeEvent {
  type: "AI_MODE_CHANGE";
  agencyId: string;
  aiEnabled: boolean;
  features: AIGateFeatureMap;
  toggledAt: string;
}

export const AI_GATE_DEFAULT_FEATURES: AIGateFeatureMap = {
  callHandling: true,
  incidentSuggestions: true,
  priorityScoring: true,
  transcription: true,
  summaries: true,
  cameraAnalysis: true,
  translation: true,
  patternDetection: true,
};

export function defaultAIGateConfig(agencyId: string): AIGateConfig {
  return {
    agencyId,
    aiEnabled: true,
    features: { ...AI_GATE_DEFAULT_FEATURES },
    toggledAt: new Date(0).toISOString(),
    toggledBy: "system",
    toggleReason: null,
  };
}

/** Merge a toggle request onto an existing config, enforcing master-off invariant. */
export function applyToggle(
  current: AIGateConfig,
  req: AIGateToggleRequest,
  actorId: string,
): AIGateConfig {
  const now = new Date().toISOString();
  const mergedFeatures: AIGateFeatureMap = req.enabled
    ? { ...current.features, ...(req.features ?? {}) }
    : (Object.fromEntries(AI_GATE_FEATURES.map((k) => [k, false])) as AIGateFeatureMap);

  return {
    agencyId: current.agencyId,
    aiEnabled: req.enabled,
    features: mergedFeatures,
    toggledAt: now,
    toggledBy: actorId,
    toggleReason: req.reason ?? null,
  };
}

/** True when master AI is on and the named feature is enabled. */
export function isAIGateFeatureOn(config: AIGateConfig, feature: AIGateFeatureKey): boolean {
  return config.aiEnabled && Boolean(config.features[feature]);
}
