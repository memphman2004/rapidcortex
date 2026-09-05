import { notFound, redirect } from "next/navigation";
import { OnboardingPacketsClient } from "@/components/onboarding/onboarding-packets-client";
import { getAppDashboardSession } from "@/app/(app)/_lib/dashboard-session";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";
import { onboardingPacketVerticalsForRole } from "rapid-cortex-shared";

export const metadata = {
  title: "Onboarding packet",
  robots: { index: false, follow: false },
};

export default async function OnboardingPacketsPage() {
  if (!isVerticalOnboardingEnabled()) notFound();
  const session = await getAppDashboardSession();
  if (onboardingPacketVerticalsForRole(session.user.role).length === 0) {
    redirect("/unauthorized");
  }
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Packet
      </p>
      <OnboardingPacketsClient />
    </div>
  );
}
