import type { UserContext } from "rapid-cortex-shared/types";
import { getDashboardSummaryForUser } from "@/lib/dashboards/get-dashboard-summary";
import { DashboardLiveDataHint } from "./dashboard-live-data-hint";
import { ActivityFeed } from "./activity-feed";
import { IncidentTable } from "@/components/dispatch/incident-table";
import { SlaStatusBar } from "./sla-status-bar";
import { StatCard } from "./stat-card";
import { DispatcherActiveCallsPanel } from "@/components/call-control/dispatcher-active-calls-panel";
import {
  AiSummaryPanel,
  CadReadyPanel,
  CallerInfoPanel,
  CallerMediaPanel,
  LiveCallWorkspace,
  ManualModeButton,
  SupervisorAssistPanel,
  TranscriptionPanel,
  TranslationPanel,
} from "./dispatcher-workspace-panels";

export function DispatcherDashboardContent({ user }: { user: UserContext }) {
  const data = getDashboardSummaryForUser("dispatcher", user);
  const activeIncidentId = data.incidents[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-white">Dispatcher operations</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Live call handling view optimized for current incident speed and readability. AI output is
          assistive only and must be reviewed by dispatch.
        </p>
        <ul className="list-inside list-disc text-xs text-slate-500">
          <li>
            TODO: Load active incident + queue from API with agency-scoped filters and
            shift-assignment checks.
          </li>
          <li>
            TODO: Audit log manual mode changes and CAD submissions with userId, role, agencyId,
            incidentId, timestamp, and reason.
          </li>
        </ul>
        <DashboardLiveDataHint feature="sla" />
      </section>

      <SlaStatusBar />

      <DispatcherActiveCallsPanel />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((s) => (
          <StatCard key={s.id} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </section>

      <LiveCallWorkspace>
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-3">
            <IncidentTable rows={data.incidents} emptyHint="No active calls in your queue." />
          </div>
          <div className="space-y-4 xl:col-span-6">
            <TranscriptionPanel />
            <TranslationPanel />
            <AiSummaryPanel />
          </div>
          <div className="space-y-4 xl:col-span-3">
            <CallerInfoPanel />
            <CallerMediaPanel incidentId={activeIncidentId} />
            <CadReadyPanel incident={null} />
          </div>
        </div>
        <div id="shift-notes" className="mt-4 grid gap-4 border-t border-slate-800 pt-4 lg:grid-cols-2">
          <SupervisorAssistPanel />
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Manual and notes controls</h3>
              <ManualModeButton />
            </div>
            <p className="text-xs text-slate-400">
              Keep focus on the current incident. Capture dispatcher notes and explicit CAD review
              approvals before finalization.
            </p>
          </div>
        </div>
      </LiveCallWorkspace>

      <section id="recent-calls">
        <ActivityFeed items={data.activities} />
      </section>
    </div>
  );
}
