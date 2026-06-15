import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AdminNotificationsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Notifications</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Configure alert preferences for incidents, system events, and SLA thresholds. Notifications
          are delivered via email and in-app channels.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Coming soon</h2>
        <p className="mt-2 text-sm text-slate-400">
          Email digest settings, alert thresholds, SLA alerts, and on-call routing will be available
          in a future release. This page is reserved so admin navigation stays consistent.
        </p>
      </section>
    </div>
  );
}
