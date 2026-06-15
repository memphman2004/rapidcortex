"use client";

import { useQuery } from "@tanstack/react-query";
import type { WeeklyStaffingForecast } from "rapid-cortex-shared/staffing";
import { isApiConfigured } from "@/lib/api";

async function fetchStaffingForecast(startDate?: string): Promise<WeeklyStaffingForecast | null> {
  const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
  const res = await fetch(`/api/staffing/forecast${qs}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`);
  return res.json() as Promise<WeeklyStaffingForecast | null>;
}

export function useStaffingForecast(enabled: boolean, startDate?: string) {
  const q = useQuery({
    queryKey: ["staffing-forecast", startDate ?? "today"],
    queryFn: () => fetchStaffingForecast(startDate),
    enabled: enabled && isApiConfigured(),
    refetchInterval: 3_600_000,
    refetchOnWindowFocus: true,
    staleTime: 1_800_000,
  });

  return {
    forecast: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    mutate: () => q.refetch(),
  };
}
