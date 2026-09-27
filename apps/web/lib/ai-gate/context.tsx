"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AIGateConfig, AIGateFeatureKey } from "rapid-cortex-shared";
import { defaultAIGateConfig } from "rapid-cortex-shared";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import { isAiFeatureGateEnabled } from "@/lib/runtime-flags";

interface AIGateState extends AIGateConfig {
  isLoaded: boolean;
}

const AIGateContext = createContext<AIGateState>({
  ...defaultAIGateConfig(""),
  isLoaded: false,
});

export function AIGateProvider({
  children,
  agencyId,
  initial,
}: {
  children: ReactNode;
  agencyId: string;
  initial?: AIGateConfig;
}) {
  const [state, setState] = useState<AIGateState>({
    ...(initial ?? defaultAIGateConfig(agencyId)),
    isLoaded: !!initial,
  });

  const onWs = useCallback(
    (message: { type: string; data: Record<string, unknown> }) => {
      if (message.type !== "AI_MODE_CHANGE") return;
      const data = message.data ?? {};
      if (data.agencyId && data.agencyId !== agencyId) return;
      setState((prev) => ({
        ...prev,
        aiEnabled: typeof data.aiEnabled === "boolean" ? data.aiEnabled : prev.aiEnabled,
        features: (data.features as AIGateConfig["features"]) ?? prev.features,
        toggledAt: typeof data.toggledAt === "string" ? data.toggledAt : prev.toggledAt,
        isLoaded: true,
      }));
    },
    [agencyId],
  );

  useAgencyWebSocket(onWs, { enabled: isAiFeatureGateEnabled() && Boolean(agencyId) });

  useEffect(() => {
    if (initial || !agencyId || !isAiFeatureGateEnabled()) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/agency/${encodeURIComponent(agencyId)}/config/ai-mode`, {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const cfg = (await res.json()) as AIGateConfig;
        if (cancelled) return;
        setState({ ...cfg, isLoaded: true });
      } catch {
        /* keep default-on */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, initial]);

  return <AIGateContext.Provider value={state}>{children}</AIGateContext.Provider>;
}

export function useAIGate(): AIGateState {
  return useContext(AIGateContext);
}

export function useAIFeature(feature: AIGateFeatureKey): boolean {
  const { aiEnabled, features } = useContext(AIGateContext);
  if (!isAiFeatureGateEnabled()) return true;
  return aiEnabled && (features[feature] ?? false);
}

export function useAIEnabled(): boolean {
  const { aiEnabled } = useContext(AIGateContext);
  if (!isAiFeatureGateEnabled()) return true;
  return aiEnabled;
}
