import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { CampusZonesClient } from "../_components/CampusZonesClient";

export default async function CampusZonesPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/zones`);
  const role = user.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("zones", role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  const agencyId = user.agencyId?.trim();
  if (!agencyId) {
    return (
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-5">
        <h2 className="text-lg font-semibold text-amber-100">Campus tenant not found</h2>
        <p className="mt-2 text-sm text-amber-200/80">
          Your account is not linked to a campus agency for{" "}
          <span className="font-mono">{campusCode.toUpperCase()}</span>.
        </p>
      </section>
    );
  }

  return <CampusZonesClient campusCode={campusCode.toUpperCase()} agencyId={agencyId} />;
}
