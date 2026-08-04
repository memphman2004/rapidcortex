import { redirect } from "next/navigation";
import { CampusCamerasClient } from "./campus-cameras-client";
import { VenueCamerasSettingsClient } from "@/components/venue/venue-cameras-settings-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function CampusCamerasPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/cameras`);
  }

  const role = user.role.trim().toUpperCase();
  const canManageRegistry =
    role === "CAMPUS_ADMIN" ||
    role === "CAMPUS_SUPERVISOR" ||
    role === "RCSUPERADMIN" ||
    role === "RCADMIN";

  return (
    <div className="space-y-8">
      {canManageRegistry && user.agencyId ? (
        <VenueCamerasSettingsClient agencyId={user.agencyId} apiVertical="campus" />
      ) : null}
      <CampusCamerasClient campusCode={campusCode} />
    </div>
  );
}
