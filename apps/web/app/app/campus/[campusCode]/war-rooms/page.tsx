import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isWarRoomsEnabled } from "@/lib/runtime-flags";
import { CampusWarRoomsClient } from "@/components/campus/campus-war-rooms-client";

export default async function CampusWarRoomsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  if (!isWarRoomsEnabled()) {
    redirect(`/app/campus/${campusCode}`);
  }
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("war-rooms", role)) {
    redirect(`/app/campus/${campusCode}`);
  }
  return (
    <section className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold text-white">Campus war rooms</h2>
      <div className="mt-4">
        <CampusWarRoomsClient campusCode={campusCode} />
      </div>
    </section>
  );
}
