import { VisionAiOpsConsole } from "@/components/rapid-vision/VisionAiOpsConsole";
import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";

export default async function CampusVisionAiPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(campusCode)}/vision-ai`);
  if (!canViewCampusNavItem("vision-ai", user.role)) {
    redirect(`/app/campus/${campusCode}`);
  }
  return (
    <VisionAiOpsConsole
      title="Campus Camera AI"
      subtitle="Proactive camera alerts for campus safety. AI never creates an incident or dispatches units."
    />
  );
}
