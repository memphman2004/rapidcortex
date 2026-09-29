import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { DistrictSchoolsPanel } from "@/components/campus/k12/DistrictSchoolsPanel";

/** Full district schools list — used by K-12 “View all” from the dashboard panel. */
export default async function CampusSitesPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/sites`);
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(campusCode)}`);

  const code = campusCode.toUpperCase();
  return (
    <div>
      <h1 style={{ margin: "0 0 12px", fontSize: 18, color: "#e4dff5" }}>District Schools</h1>
      <DistrictSchoolsPanel agencyId={user.agencyId} linkBase={`/app/campus/${code}`} />
    </div>
  );
}
