import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";

export default async function CampusZonesPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("zones", role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  return (
    <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold text-white">Campus zones</h2>
      <p className="mt-2 text-sm text-slate-400">
        Building and zone map with incident heat for {campusCode.toUpperCase()}.
      </p>
    </section>
  );
}
