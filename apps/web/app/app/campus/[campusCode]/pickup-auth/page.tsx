import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { PickupAuthClient } from "./pickup-auth-client";

export default async function CampusPickupAuthPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/pickup-auth`);
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(campusCode)}`);

  return (
    <PickupAuthClient
      agencyId={user.agencyId}
      campusCode={campusCode.toUpperCase()}
      userRole={user.role}
    />
  );
}
