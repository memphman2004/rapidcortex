import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";

export default async function CampusReportsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("reports", role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  return (
    <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold text-white">Campus reports</h2>
      <p className="mt-2 text-sm text-slate-400">
        Monthly incident trends, top buildings, and scan-point activity for {campusCode.toUpperCase()}.
      </p>
    </section>
  );
}
