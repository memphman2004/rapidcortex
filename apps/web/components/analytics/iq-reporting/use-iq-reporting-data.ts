"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchIQReporting } from "@/lib/analytics/iq-reporting-api";
import type { IQDailyRecord, IQTimeRange, IQVertical } from "@/lib/analytics/iq-reporting-types";

export function useIQReportingData(
  agencyId: string,
  vertical: IQVertical,
  range: IQTimeRange,
  compare = false,
): {
  records: IQDailyRecord[];
  prior: IQDailyRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [records, setRecords] = useState<IQDailyRecord[]>([]);
  const [prior, setPrior] = useState<IQDailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!agencyId) {
      setRecords([]);
      setPrior([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = await fetchIQReporting(agencyId, vertical, range, { compare });
      setRecords(payload.current);
      setPrior(payload.prior ?? []);
      setError(null);
    } catch (err) {
      setRecords([]);
      setPrior([]);
      setError(err instanceof Error ? err.message : "Failed to load reporting");
    } finally {
      setLoading(false);
    }
  }, [agencyId, vertical, range, compare]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { records, prior, loading, error, refresh };
}
