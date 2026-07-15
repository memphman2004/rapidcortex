"use client";

import { useQuery } from "@tanstack/react-query";
import type { TriageQueueItem } from "rapid-cortex-shared/triage";
import { isOptionalFeatureForbiddenError } from "@/lib/addon-gate-errors";
import { fetchTriageQueue, isApiConfigured } from "@/lib/api";

export type TriageQueueResponse = {
  items: TriageQueueItem[];
  count: number;
};

export function useTriagePolling(enabled: boolean) {
  const q = useQuery({
    queryKey: ["triage-queue"],
    queryFn: async (): Promise<TriageQueueResponse> => {
      const data = await fetchTriageQueue();
      return { items: data.items, count: data.count };
    },
    enabled: enabled && isApiConfigured(),
    refetchInterval: (query) =>
      isOptionalFeatureForbiddenError(query.state.error) ? false : 10_000,
    retry: (failureCount, error) => {
      if (isOptionalFeatureForbiddenError(error)) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  const addonBlocked = isOptionalFeatureForbiddenError(q.error);

  return {
    items: q.data?.items ?? [],
    count: q.data?.count ?? 0,
    isLoading: q.isLoading,
    isError: q.isError && !addonBlocked,
    addonBlocked,
    mutate: () => q.refetch(),
  };
}
