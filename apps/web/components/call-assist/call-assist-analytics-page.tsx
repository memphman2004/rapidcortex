"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { canViewCallAssistAnalytics } from "@/lib/call-assist/access";
import { getCallAssistAnalyticsDashboard } from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function aht(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CallAssistAnalyticsPage() {
  const { user } = useSession();
  const { requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const allowed = canViewCallAssistAnalytics(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed && ready);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shift, setShift] = useState("");
  const [dispatcherId, setDispatcherId] = useState("");
  const [language, setLanguage] = useState("");
  const [location, setLocation] = useState("");
  const [routingDestination, setRoutingDestination] = useState("");

  const dash = useQuery({
    queryKey: [
      "call-assist-analytics-dash",
      agencyId,
      from,
      to,
      shift,
      dispatcherId,
      language,
      location,
      routingDestination,
    ],
    queryFn: () =>
      getCallAssistAnalyticsDashboard(
        { from, to, shift, dispatcherId, language, location, routingDestination },
        requestAgencyId,
      ),
    enabled,
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">Call Assist analytics is limited to supervisors, analysts, and administrators.</p>;
  }

  const d = dash.data?.dashboard;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <CallAssistChrome title="Call Assist analytics" />
      <p className="max-w-2xl text-[12px] text-slate-500">
        AHT, containment, abandonment, queue depth, CSAT, heat maps, false-transfer, human takeover, online-reporting
        diversion, and self-service completion. Filters apply to the selected window.
      </p>
      <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="From (ISO)" value={from} onChange={setFrom} />
        <Field label="To (ISO)" value={to} onChange={setTo} />
        <Field label="Shift" value={shift} onChange={setShift} />
        <Field label="Dispatcher ID" value={dispatcherId} onChange={setDispatcherId} />
        <Field label="Language" value={language} onChange={setLanguage} />
        <Field label="Location" value={location} onChange={setLocation} />
        <Field label="Routing destination" value={routingDestination} onChange={setRoutingDestination} />
      </form>
      <p className="text-[11px] text-slate-500">
        Window {d?.window.from ? new Date(d.window.from).toLocaleString() : "—"} →{" "}
        {d?.window.to ? new Date(d.window.to).toLocaleString() : "—"} · {d?.window.sessionCount ?? 0} sessions
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="AHT" value={aht(d?.ahtSeconds)} />
        <Stat label="Containment" value={pct(d?.containmentRate)} />
        <Stat label="Abandonment" value={pct(d?.abandonmentRate)} />
        <Stat label="Queue now / peak" value={`${d?.queueDepthCurrent ?? 0} / ${d?.queueDepthPeak ?? 0}`} />
        <Stat label="CSAT" value={d?.csatAverage != null ? `${d.csatAverage.toFixed(2)} (${d.csatCount})` : "—"} />
        <Stat label="False transfer" value={pct(d?.falseTransferRate)} />
        <Stat label="Human takeover" value={pct(d?.humanTakeoverRate)} />
        <Stat label="Online-report diversion" value={pct(d?.onlineReportingDiversionRate)} />
        <Stat label="Self-service completion" value={pct(d?.selfServiceCompletionRate)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Heat title="Location" rows={d?.heatMaps.location ?? []} />
        <Heat title="Language" rows={d?.heatMaps.language ?? []} />
        <Heat title="Routing destination" rows={d?.heatMaps.routing ?? []} />
        <Heat title="Hour of day (UTC)" rows={d?.heatMaps.hourOfDay ?? []} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-[11px] text-slate-400">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <p className="text-[18px] font-semibold text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Heat({ title, rows }: { title: string; rows: Array<{ key: string; label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-lg border border-slate-800 p-3">
      <h2 className="mb-2 text-[12px] font-semibold text-slate-200">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-500">No data in this window.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-28 truncate text-slate-400" title={r.label}>
                {r.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                <span className="block h-2 bg-sky-600" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="w-8 text-right font-mono text-slate-300">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
