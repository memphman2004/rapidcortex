import { redirect } from "next/navigation";
import { OnboardingPacketsClient } from "@/components/onboarding/onboarding-packets-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export default async function CampusOnboardingPacketsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  if (!isVerticalOnboardingEnabled()) notFound();
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem("settings", role)) {
    redirect(`/app/campus/${campusCode}`);
  }
  return <OnboardingPacketsClient heading="Campus onboarding packet" />;
}
