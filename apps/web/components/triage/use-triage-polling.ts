"use client";

import { useQuery } from "@tanstack/react-query";
import type { TriageQueueItem } from "rapid-cortex-shared/triage";
import { isApiConfigured } from "@/lib/api";

export type TriageQueueResponse = {
  items: TriageQueueItem[];
  count: number;
};

async function fetchTriageQueue(): Promise<TriageQueueResponse> {
  const res = await fetch("/api/triage/queue");
  if (!res.ok) throw new Error(`Queue fetch failed: ${res.status}`);
  return res.json() as Promise<TriageQueueResponse>;
}

export function useTriagePolling(enabled: boolean) {
  const q = useQuery({
    queryKey: ["triage-queue"],
    queryFn: fetchTriageQueue,
    enabled: enabled && isApiConfigured(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  return {
    items: q.data?.items ?? [],
    count: q.data?.count ?? 0,
    isLoading: q.isLoading,
    isError: q.isError,
    mutate: () => q.refetch(),
  };
}
