import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { VisitorVerificationClient } from "./visitor-verification-client";

export default async function CampusVisitorsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/visitors`);
  if (!user.agencyId) redirect(`/app/campus/${encodeURIComponent(campusCode)}`);

  return (
    <VisitorVerificationClient
      agencyId={user.agencyId}
      campusCode={campusCode.toUpperCase()}
      agencyName={campusCode.toUpperCase()}
    />
  );
}
