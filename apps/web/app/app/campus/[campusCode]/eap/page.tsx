import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isCampusEapEnabled } from "@/lib/runtime-flags";
import { CampusEapLibraryClient } from "@/components/campus/campus-eap-library-client";

export default async function CampusEapPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isCampusEapEnabled()) {
    redirect(`/app/campus/${campusCode}`);
  }
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("eap", role)) {
    redirect(`/app/campus/${campusCode}`);
  }
  return (
    <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold text-white">Campus EAP / checklist library</h2>
      <div className="mt-4">
        <CampusEapLibraryClient campusCode={campusCode} />
      </div>
    </section>
  );
}
