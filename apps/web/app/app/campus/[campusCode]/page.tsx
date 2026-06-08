import { CampusDashboardHome } from "@/components/dashboards/DashboardHomeRenderer";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { CampusIncidentQueueHome } from "./_components/campus-incident-queue-home";

export default async function CampusHomePage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const normalizedCode = campusCode.toUpperCase();
  const user = await getDashboardSessionUser();
  if (!user) return null;

  const role = user.role?.trim().toUpperCase() ?? "";
  if (role === "CAMPUS_DISPATCH") {
    return (
      <div className="space-y-5">
        <header className="rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-4 py-3">
          <h1 className="text-xl font-semibold text-emerald-50">Campus Safety — {normalizedCode}</h1>
          <p className="mt-1 max-w-2xl text-sm text-emerald-100/70">
            School and university incident intake from QR and SMS reports. This is not a 911 dispatch
            workstation — escalate to your public safety agency when required.
          </p>
        </header>
        <CampusIncidentQueueHome campusCode={normalizedCode} />
      </div>
    );
  }

  return (
    <CampusDashboardHome
      campusCode={normalizedCode}
      role={user.role}
      agencyId={user.agencyId}
      displayName={dashboardDisplayName(user)}
    />
  );
}
