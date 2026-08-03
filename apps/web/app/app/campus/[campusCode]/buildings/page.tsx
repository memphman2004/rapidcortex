import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { normalizeCampusCode } from "@/lib/campus/campus-access";
import { CampusBuildingsClient } from "../_components/CampusBuildingsClient";

export default async function CampusBuildingsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode: raw } = await params;
  const campusCode = normalizeCampusCode(raw);
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  const role = user.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("buildings", role)) {
    redirect(`/app/campus/${raw}`);
  }

  const agencyId = user.agencyId?.trim();
  if (!agencyId) {
    return (
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-5">
        <h2 className="text-lg font-semibold text-amber-100">Campus tenant not found</h2>
        <p className="mt-2 text-sm text-amber-200/80">
          Your account is not linked to a campus agency for <span className="font-mono">{campusCode}</span>.
        </p>
      </section>
    );
  }

  return <CampusBuildingsClient campusCode={campusCode} agencyId={agencyId} />;
}
