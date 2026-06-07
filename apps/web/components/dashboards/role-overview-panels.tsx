import Link from "next/link";
import type { DashboardMockPayload } from "@/lib/dashboards/mockDashboardData";

export function QaReviewQueuePanel({ data }: { data: DashboardMockPayload }) {
  const pending = data.stats.find((s) => s.id === "d1")?.value ?? "—";
  const highRisk = data.stats.find((s) => s.id === "d5")?.value ?? "—";

  return (
    <section className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-4">
      <h2 className="text-sm font-semibold text-white">QA review queue</h2>
      <p className="mt-1 text-xs text-slate-400">
        Calls awaiting scorecards and protocol review. Open the jurisdiction QA workspace for full
        transcripts.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Pending review</dt>
          <dd className="mt-1 text-lg font-semibold text-white">{pending}</dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">High-risk flagged</dt>
          <dd className="mt-1 text-lg font-semibold text-amber-200">{highRisk}</dd>
        </div>
      </dl>
      <Link href="/qa" className="mt-4 inline-flex text-xs font-semibold text-violet-300 hover:text-violet-200">
        Open QA workspace →
      </Link>
    </section>
  );
}

export function AgencyAdminSummaryPanel() {
  return (
    <section className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-4">
      <h2 className="text-sm font-semibold text-white">Administration</h2>
      <p className="mt-1 text-xs text-slate-400">
        Manage users, entitlements, and agency configuration. Operational dispatch views live under
        your jurisdiction workspace.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <li>
          <Link
            href="/agency-admin/features"
            className="block rounded border border-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
          >
            Features & add-ons
          </Link>
        </li>
        <li>
          <Link
            href="/agency-admin/billing"
            className="block rounded border border-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
          >
            Billing & usage
          </Link>
        </li>
        <li>
          <Link
            href="/admin/users"
            className="block rounded border border-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
          >
            Users & roles
          </Link>
        </li>
        <li>
          <Link
            href="/admin/cad"
            className="block rounded border border-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
          >
            CAD integration
          </Link>
        </li>
      </ul>
    </section>
  );
}

export function ItSecurityPosturePanel() {
  return (
    <section className="rounded-lg border border-teal-900/40 bg-teal-950/15 p-4">
      <h2 className="text-sm font-semibold text-white">Security posture</h2>
      <p className="mt-1 text-xs text-slate-400">
        Authentication health, integration status, and audit evidence. Incident queues are not shown
        on this dashboard.
      </p>
      <ul className="mt-4 space-y-2 text-xs text-slate-300">
        <li className="rounded border border-slate-800 px-3 py-2">MFA adoption and session hygiene</li>
        <li className="rounded border border-slate-800 px-3 py-2">CAD and API connectivity checks</li>
        <li className="rounded border border-slate-800 px-3 py-2">Export and retention audit trail</li>
      </ul>
      <Link
        href="/admin/security"
        className="mt-4 inline-flex text-xs font-semibold text-teal-300 hover:text-teal-200"
      >
        Open security settings →
      </Link>
    </section>
  );
}

export function ExecutiveTrendsPanel() {
  return (
    <section className="rounded-lg border border-rose-900/30 bg-rose-950/10 p-4">
      <h2 className="text-sm font-semibold text-white">Trends & reporting</h2>
      <p className="mt-1 text-xs text-slate-400">
        Aggregate operational trends for leadership review. No live call handling or unit dispatch
        controls appear here.
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[62, 48, 71, 55, 44, 58, 66, 52].map((h, i) => (
          <div
            key={i}
            className="rounded-sm bg-rose-900/30"
            style={{ height: `${h}px` }}
            aria-hidden
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">30-day incident volume trend — preview</p>
    </section>
  );
}
