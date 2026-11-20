import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { BtamClient } from "./btam-client";

export default async function BtamPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${campusCode}/btam`);
  }
  if (!canViewCampusNavItem("btam", user.role)) {
    redirect(`/app/campus/${campusCode}`);
  }

  return (
    <BtamClient
      campusCode={campusCode}
      agencyId={user.agencyId}
      userRole={user.role}
    />
  );
}
