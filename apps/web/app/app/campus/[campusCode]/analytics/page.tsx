import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { CampusAnalyticsClient } from "../_components/CampusAnalyticsClient";

export default async function CampusAnalyticsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("analytics", role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  return <CampusAnalyticsClient campusCode={campusCode} />;
}
