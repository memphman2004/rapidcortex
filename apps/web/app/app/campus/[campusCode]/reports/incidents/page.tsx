import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { IncidentLogClient } from "./incident-log-client";

/** K-12 Incident Log — replaces Daily Crime Log in nav for district agencies. */
export default async function CampusIncidentLogPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/reports/incidents`);
  }
  return <IncidentLogClient campusCode={campusCode.toUpperCase()} agencyId={user.agencyId ?? ""} />;
}
