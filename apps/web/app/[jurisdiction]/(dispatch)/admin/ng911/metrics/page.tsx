"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { fetchDataPathExport, fetchNg911Metrics, fetchNgSecEvidence } from "@/lib/ng911/ng911-api";
import { isNg911AssistEnabled } from "@/lib/runtime-flags";

function canViewMetrics(role: string | undefined): boolean {
  return (
    role === "agencyadmin" ||
    role === "agencyit" ||
    role === "supervisor" ||
    role === "analyst" ||
    role === "auditor" ||
    role === "rcsuperadmin" ||
    role === "rcadmin" ||
    role === "dispatcher"
  );
}

/** Compliance / export packs — not for floor supervisors or dispatchers. */
function canViewCompliancePacks(role: string | undefined): boolean {
  return (
    role === "rcsuperadmin" ||
    role === "rcadmin" ||
    role === "rcitadmin" ||
    role === "auditor" ||
    role === "agencyit"
  );
}

export default function AdminNg911MetricsPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const showCompliance = canViewCompliancePacks(user?.role);

  const metricsQuery = useQuery({
    queryKey: ["ng911-metrics"],
    queryFn: () => fetchNg911Metrics(),
    enabled: Boolean(user && isApiConfigured() && isNg911AssistEnabled() && canViewMetrics(user.role)),
  });

  const evidenceQuery = useQuery({
    queryKey: ["ng911-ng-sec"],
    queryFn: () => fetchNgSecEvidence(),
    enabled: Boolean(
      user && isApiConfigured() && isNg911AssistEnabled() && showCompliance && canViewMetrics(user.role),
    ),
  });

  const dataPathQuery = useQuery({
    queryKey: ["ng911-datapath"],
    queryFn: () => fetchDataPathExport(),
    enabled: Boolean(
      user && isApiConfigured() && isNg911AssistEnabled() && showCompliance && canViewMetrics(user.role),
    ),
  });

  if (!user) return null;

  if (!canViewMetrics(user.role)) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">You do not have permission to view NG9-1-1 metrics.</p>
      </div>
    );
  }

  if (!isNg911AssistEnabled()) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-white">NG9-1-1 metrics</h1>
        <p className="max-w-xl text-sm text-slate-400">
          NG9-1-1 assist is not enabled for this agency. Contact Rapid Cortex support to turn it on.
        </p>
      </div>
    );
  }

  const m = metricsQuery.data;
  const crisis = m?.crisis;

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">NG9-1-1 assist</p>
        <h1 className="text-lg font-semibold text-white">Call-processing metrics</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Diversion, crisis support, triage, and assist activity for your agency.
        </p>
        <p className="mt-2 text-sm">
          <Link href={to("/admin/ng911/diversion")} className="text-sky-400 hover:underline">
            Diversion workflows
          </Link>
          {" · "}
          <Link href={to("/admin/ng911/crisis")} className="text-sky-400 hover:underline">
            Crisis protocols
          </Link>
        </p>
      </div>

      {metricsQuery.isLoading ? <p className="text-sm text-slate-500">Loading metrics…</p> : null}
      {metricsQuery.isError ? (
        <p className="text-sm text-rose-300">{(metricsQuery.error as Error).message}</p>
      ) : null}

      {m ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Diversion"
            rows={[
              ["Sessions started", m.diversion.sessionsStarted],
              ["Matched", m.diversion.matched],
              ["SMS sent", m.diversion.smsSent],
              ["Opted out to live", m.diversion.optedOutToLive],
              ["No match", m.diversion.noMatch],
            ]}
          />
          <MetricCard
            title="Crisis diversion"
            rows={[
              ["Assessments", crisis?.assessmentsStarted ?? 0],
              ["Hard stops", crisis?.hardStops ?? 0],
              ["Warm transfers", crisis?.warmTransfers ?? 0],
              ["Phone resolved", crisis?.phoneResolved ?? 0],
              ["Diverted from LE", crisis?.divertedFromLe ?? 0],
              ["Est. savings USD", Math.round(crisis?.estimatedSavingsUsd ?? 0)],
            ]}
          />
          <MetricCard
            title="Triage"
            rows={[
              ["Classified", m.triage.classified],
              ["Non-emergency queued", m.triage.nonEmergencyQueued],
              ["Escalated", m.triage.escalated],
              ["Overridden", m.triage.overridden],
            ]}
          />
          <MetricCard
            title="Assist"
            rows={[
              ["Transcript appends", m.assist.transcriptAppends],
              ["EIDO exports", m.assist.eidoExports],
              ["EIDO imports", m.assist.eidoImports],
              ["Additional Data packages", m.assist.additionalDataPackages],
              ["Silent text", m.assist.silentTextSessions],
              ["Video assist starts", m.assist.videoAssistStarts],
            ]}
          />
        </div>
      ) : null}

      {showCompliance ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Assist summary export</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Downloadable summary for compliance and reporting (IT / audit roles).
                </p>
              </div>
              {dataPathQuery.data ? (
                <button
                  type="button"
                  className="text-xs text-sky-400 hover:underline"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(dataPathQuery.data, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `datapath-assist-${user.agencyId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download JSON
                </button>
              ) : null}
            </div>
            {dataPathQuery.data ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {dataPathQuery.data.elements.map((el) => (
                  <li
                    key={el.elementId}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300"
                  >
                    <p className="font-medium text-white">{el.label}</p>
                    <p className="mt-0.5 text-lg font-semibold text-sky-200">{String(el.value)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Security controls checklist</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Control status for compliance review (IT / audit roles).
                </p>
              </div>
              {evidenceQuery.data ? (
                <button
                  type="button"
                  className="text-xs text-sky-400 hover:underline"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(evidenceQuery.data, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ng-sec-evidence-${user.agencyId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download JSON
                </button>
              ) : null}
            </div>
            {evidenceQuery.isLoading ? <p className="text-sm text-slate-500">Loading checklist…</p> : null}
            {evidenceQuery.data ? (
              <ul className="space-y-2">
                {evidenceQuery.data.controls.map((c) => (
                  <li
                    key={c.controlId}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300"
                  >
                    <p className="font-medium text-white">
                      {c.title}{" "}
                      <span className="font-normal capitalize text-slate-500">· {c.status}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-sm">
            <dt className="text-slate-400">{label}</dt>
            <dd className="tabular-nums text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
