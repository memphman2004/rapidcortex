import { redirect } from "next/navigation";
import { OnboardingPacketsClient } from "@/components/onboarding/onboarding-packets-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Onboarding packet",
  robots: { index: false, follow: false },
};

export default async function AgencyAdminOnboardingPacketsPage() {
  if (!isVerticalOnboardingEnabled()) notFound();
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  return <OnboardingPacketsClient heading="PSAP onboarding packet" />;
}
