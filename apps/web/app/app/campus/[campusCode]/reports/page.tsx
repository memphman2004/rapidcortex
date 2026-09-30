import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { CampusReportsClient } from "./reports-client";

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

  return <CampusReportsClient campusCode={campusCode.toUpperCase()} />;
}
