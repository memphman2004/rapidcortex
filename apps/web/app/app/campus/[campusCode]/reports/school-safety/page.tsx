import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { SchoolSafetyReportClient } from "./school-safety-report-client";

export default async function SchoolSafetyReportPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/reports/school-safety`);
  }
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(campusCode)}`);

  return (
    <SchoolSafetyReportClient agencyId={user.agencyId} campusCode={campusCode.toUpperCase()} />
  );
}
