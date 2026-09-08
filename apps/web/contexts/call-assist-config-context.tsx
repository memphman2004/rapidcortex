"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AgencyTaxonomy,
  CallAssistUiProfile,
} from "rapid-cortex-shared";
import { useCallAssistAgencyScope } from "@/contexts/agency-context";
import { isApiConfigured } from "@/lib/api";
import { getCallAssistRuntimeConfig, getCallAssistUiProfile } from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

export type CallAssistRuntimeBundle = {
  config: Record<string, unknown>;
  taxonomy: AgencyTaxonomy;
  currentShift: string | null;
  onboardingComplete: boolean;
};

type CallAssistConfigContextValue = {
  /** Derived labels + capabilities for chrome, monitor, handoff. */
  config: CallAssistUiProfile | null;
  runtime: CallAssistRuntimeBundle | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  agencyId: string | null;
  requestAgencyId: string | undefined;
  ready: boolean;
};

const CallAssistConfigContext = createContext<CallAssistConfigContextValue | null>(null);

/**
 * Tenant Call Assist config. All dashboard surfaces read labels from `config`
 * (never hardcoded agency names or statutes). Re-fetches when `agencyId` changes.
 */
export function CallAssistConfigProvider({ children }: { children: React.ReactNode }) {
  const { requestAgencyId, agencyId, ready } = useCallAssistAgencyScope();
  const qc = useQueryClient();
  const enabled = Boolean(ready && isApiConfigured() && isCallAssistEnabled());

  const profileQuery = useQuery({
    queryKey: ["call-assist-ui-profile", agencyId],
    queryFn: () => getCallAssistUiProfile(requestAgencyId),
    enabled,
  });
  const runtimeQuery = useQuery({
    queryKey: ["call-assist-runtime-config", agencyId],
    queryFn: () => getCallAssistRuntimeConfig(requestAgencyId),
    enabled,
  });

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["call-assist-ui-profile"] }),
      qc.invalidateQueries({ queryKey: ["call-assist-runtime-config"] }),
      qc.invalidateQueries({ queryKey: ["call-assist-config"] }),
      qc.invalidateQueries({ queryKey: ["call-assist-external"] }),
    ]);
  }, [qc]);

  const error =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : runtimeQuery.error instanceof Error
        ? runtimeQuery.error.message
        : null;

  const value = useMemo<CallAssistConfigContextValue>(
    () => ({
      config: profileQuery.data?.profile ?? null,
      runtime: runtimeQuery.data
        ? {
            config: runtimeQuery.data.config,
            taxonomy: runtimeQuery.data.taxonomy,
            currentShift: runtimeQuery.data.currentShift,
            onboardingComplete: runtimeQuery.data.onboardingComplete,
          }
        : null,
      isLoading: enabled && (profileQuery.isLoading || runtimeQuery.isLoading),
      error,
      refresh,
      agencyId,
      requestAgencyId,
      ready,
    }),
    [
      profileQuery.data?.profile,
      profileQuery.isLoading,
      runtimeQuery.data,
      runtimeQuery.isLoading,
      error,
      refresh,
      agencyId,
      requestAgencyId,
      ready,
      enabled,
    ],
  );

  return <CallAssistConfigContext.Provider value={value}>{children}</CallAssistConfigContext.Provider>;
}

export function useCallAssistConfig(): CallAssistConfigContextValue {
  const ctx = useContext(CallAssistConfigContext);
  if (!ctx) {
    throw new Error("useCallAssistConfig must be used within CallAssistConfigProvider");
  }
  return ctx;
}
