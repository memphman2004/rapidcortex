"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle, Settings2, Zap } from "lucide-react";
import type { CoResponderUnit } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

const RESPONSE_TYPES = [
  "mental_health",
  "substance_use",
  "welfare_check",
  "non_emergency_medical",
  "housing_crisis",
  "domestic_dispute_non_violent",
  "noise_complaint",
  "quality_of_life",
] as const;

type AgencyAltSettings = {
  enabled: boolean;
  confidenceThreshold: number;
  types: Record<string, boolean>;
};

function settingsKey(agencyId: string) {
  return `nexcort-alt-response-settings:${agencyId}`;
}

const statusColor: Record<string, string> = {
  available: "text-emerald-400",
  responding: "text-sky-400",
  on_scene: "text-amber-400",
  unavailable: "text-red-400",
  off_shift: "text-slate-500",
};

export function AltResponseClient({ params }: Props) {
  use(params);
  const { user } = useSession();
  const agencyId = user?.agencyId || "unknown";
  const enabled = isFeaturesSuiteUiEnabled();

  const [settings, setSettings] = useState<AgencyAltSettings>({
    enabled: true,
    confidenceThreshold: 70,
    types: Object.fromEntries(RESPONSE_TYPES.map((t) => [t, true])),
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(settingsKey(agencyId));
      if (raw) setSettings(JSON.parse(raw) as AgencyAltSettings);
    } catch {
      /* ignore */
    }
  }, [agencyId]);

  const persist = (next: AgencyAltSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(settingsKey(agencyId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const unitsQ = useQuery({
    queryKey: ["co-responders", agencyId],
    queryFn: () =>
      featureSuiteFetch<{ coResponders: CoResponderUnit[] }>("co-responders"),
    enabled,
    refetchInterval: 30_000,
  });

  if (!enabled) {
    return <div className="p-6 text-sm text-slate-400">Alt response is not enabled.</div>;
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Zap className="h-5 w-5 text-amber-400" />
          Alternative Response
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Detection settings and co-responder units for non-traditional response pathways.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-slate-400" /> Detection settings
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => persist({ ...settings, enabled: e.target.checked })}
            className="rounded border-slate-600"
          />
          Enable alternative response detection
        </label>
        <div className="mt-4">
          <label className="text-xs text-slate-400">
            Confidence threshold: {settings.confidenceThreshold}%
          </label>
          <input
            type="range"
            min={50}
            max={95}
            value={settings.confidenceThreshold}
            onChange={(e) =>
              persist({ ...settings, confidenceThreshold: Number(e.target.value) })
            }
            className="mt-1 w-full max-w-md"
          />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {RESPONSE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-xs capitalize text-slate-300">
              <input
                type="checkbox"
                checked={settings.types[t] !== false}
                onChange={(e) =>
                  persist({
                    ...settings,
                    types: { ...settings.types, [t]: e.target.checked },
                  })
                }
              />
              {t.replace(/_/g, " ")}
            </label>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Threshold and type toggles are stored per-agency in this browser until a server-side
          config endpoint is available.
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-[#161b2e]">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">
          Co-responder units
        </div>
        {unitsQ.isLoading && <p className="p-4 text-xs text-slate-500">Loading…</p>}
        {unitsQ.isError && (
          <p className="p-4 text-xs text-red-400">{(unitsQ.error as Error).message}</p>
        )}
        <ul className="divide-y divide-slate-800">
          {(unitsQ.data?.coResponders ?? []).length === 0 && !unitsQ.isLoading ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              No co-responder units configured for this agency.
            </li>
          ) : (
            (unitsQ.data?.coResponders ?? []).map((u) => (
              <li key={u.unitId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Circle
                      className={`h-2.5 w-2.5 fill-current ${statusColor[u.currentStatus] ?? "text-slate-500"}`}
                    />
                    {u.unitName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {u.type.replace(/_/g, " ")} · {u.phone}
                    {u.coverageZone ? ` · ${u.coverageZone}` : ""}
                  </div>
                  {u.specializations?.length > 0 && (
                    <div className="mt-1 text-[11px] capitalize text-slate-500">
                      {u.specializations.map((s) => s.replace(/_/g, " ")).join(", ")}
                    </div>
                  )}
                </div>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                  {u.currentStatus.replace(/_/g, " ")}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
        <h2 className="mb-2 text-sm font-semibold">Outcome reporting</h2>
        <p className="text-xs text-slate-400">
          Past alt-response decisions are recorded via{" "}
          <code className="text-slate-300">POST alt-response/{"{incidentId}"}/outcome</code> from
          the incident workspace. Use the inline Alt Response flag on an active incident to accept,
          reject, or route, then log outcomes after the call.
        </p>
      </section>
    </div>
  );
}
