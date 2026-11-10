"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SurgeForecastResponse } from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";

const DISMISS_KEY = "rc.staffing.surgeAlert.dismissedAt";

async function fetchSurgeForecast(): Promise<SurgeForecastResponse | null> {
  const res = await fetch("/api/staffing/forecast/surge", { credentials: "same-origin" });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`surge forecast ${res.status}`);
  return res.json() as Promise<SurgeForecastResponse>;
}

function barColor(pressureIndex: number): string {
  if (pressureIndex > 0.85) return "bg-red-500";
  if (pressureIndex > 0.6) return "bg-amber-400";
  return "bg-emerald-500";
}

export function SurgeForecastStrip({ enabled }: { enabled: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < 4 * 60 * 60_000) setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const q = useQuery({
    queryKey: ["staffing-surge-forecast"],
    queryFn: fetchSurgeForecast,
    enabled: enabled && isApiConfigured(),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  if (!enabled || !q.data) return null;
  const data = q.data;
  const maxCalls = Math.max(1, ...data.buckets.map((b) => Math.max(b.forecastedCalls, b.historicalAvg)));

  return (
    <div className="mt-4 rounded-lg border border-[#182334] bg-[#0b1118] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-white">2-hour surge forecast</h3>
          <p className="text-[10px] text-slate-500">15-minute buckets · refreshes every 5 minutes</p>
        </div>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
          Confidence {data.buckets[0]?.confidenceLevel ?? "low"}
        </span>
      </div>

      {data.staffingAlert && !dismissed ? (
        <div className="mb-2 flex items-start justify-between gap-2 rounded border border-red-800/60 bg-red-950/40 px-2 py-1.5 text-[11px] text-red-100">
          <p>{data.staffingAlertReason ?? "Elevated staffing pressure forecast."}</p>
          <button
            type="button"
            className="shrink-0 text-[10px] uppercase text-red-200/80 hover:text-white"
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem(DISMISS_KEY, String(Date.now()));
              } catch {
                /* ignore */
              }
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="relative flex h-24 items-end gap-1">
        {data.buckets.map((bucket) => {
          const heightPct = Math.max(8, (bucket.forecastedCalls / maxCalls) * 100);
          const avgPct = Math.max(4, (bucket.historicalAvg / maxCalls) * 100);
          return (
            <div key={bucket.startAt} className="relative flex min-w-0 flex-1 flex-col items-center justify-end">
              <div
                className="pointer-events-none absolute w-full border-t border-dashed border-sky-400/70"
                style={{ bottom: `${avgPct}%` }}
                title={`Historical avg ${bucket.historicalAvg}`}
              />
              <div
                className={`w-full rounded-t ${barColor(bucket.pressureIndex)}`}
                style={{ height: `${heightPct}%` }}
                title={`${new Date(bucket.startAt).toLocaleTimeString()} · ${bucket.forecastedCalls} calls · pressure ${bucket.pressureIndex.toFixed(2)}`}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Dashed line = historical average · color by pressure index
      </p>
    </div>
  );
}
