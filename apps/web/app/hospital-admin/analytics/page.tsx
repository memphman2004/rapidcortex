import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function HospitalAdminAnalyticsPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-6">
      <h1 className="text-lg font-semibold text-white">Performance analytics</h1>
      <p className="max-w-2xl text-sm text-slate-400">
        Facility-level routing performance and diversion trends will appear here once your agency
        enables hospital analytics. Use the capacity workspace to keep live bed status current for
        dispatch recommendations.
      </p>
    </div>
  );
}
