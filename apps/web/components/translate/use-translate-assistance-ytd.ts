"use client";

import { useEffect, useState } from "react";
import type { TranslateAssistanceSummaryResponse } from "rapid-cortex-shared";

export function useTranslateAssistanceYtd(agencyId: string | undefined, enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !agencyId) {
      setCount(null);
      return;
    }
    let cancelled = false;
    const year = new Date().getUTCFullYear();
    const from = `${year}-01-01T00:00:00.000Z`;
    const to = new Date().toISOString();
    setLoading(true);
    void (async () => {
      try {
        const q = new URLSearchParams({ agencyId, from, to });
        const res = await fetch(`/api/translate/assistance/summary?${q}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setCount(null);
          return;
        }
        const body = (await res.json()) as TranslateAssistanceSummaryResponse;
        if (!cancelled) setCount(typeof body.count === "number" ? body.count : 0);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, enabled]);

  return { count, loading };
}
