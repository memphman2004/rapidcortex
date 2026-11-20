import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { AnonymousTipsClient } from "./tips-client";

export default async function AnonymousTipsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${campusCode}/tips`);
  }
  if (!canViewCampusNavItem("tips", user.role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  return (
    <AnonymousTipsClient
      campusCode={campusCode}
      agencyId={user.agencyId}
      userRole={user.role}
    />
  );
}
