import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { CampusDrillsClient } from "./drills-client";

export default async function CampusDrillsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/drills`);
  }
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(campusCode)}`);

  return (
    <CampusDrillsClient
      agencyId={user.agencyId}
      campusCode={campusCode.toUpperCase()}
      userRole={user.role}
    />
  );
}
