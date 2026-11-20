import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { CampusVolunteersClient } from "./volunteers-client";

export default async function CampusVolunteersPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/volunteers`);
  }
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(campusCode)}`);

  return (
    <CampusVolunteersClient
      agencyId={user.agencyId}
      campusCode={campusCode.toUpperCase()}
      userRole={user.role}
    />
  );
}
