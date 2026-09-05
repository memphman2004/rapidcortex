import { notFound, redirect } from "next/navigation";
import { OnboardingPacketsClient } from "@/components/onboarding/onboarding-packets-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Onboarding packet",
  robots: { index: false, follow: false },
};

export default async function HospitalOnboardingPacketsPage() {
  if (!isVerticalOnboardingEnabled()) notFound();
  const user = await getDashboardSessionUser();
  if (!user) redirect(`${marketingLoginPath()}?from=/hospital-admin/onboarding/packets`);
  return <OnboardingPacketsClient heading="Hospital onboarding packet" />;
}
