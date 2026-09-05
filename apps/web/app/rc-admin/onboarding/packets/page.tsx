import { requireRole } from "@/lib/auth/require-role";
import { OnboardingPacketsClient } from "@/components/onboarding/onboarding-packets-client";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Onboarding packets",
  robots: { index: false, follow: false },
};

export default async function RcAdminOnboardingPacketsPage() {
  if (!isVerticalOnboardingEnabled()) notFound();
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <OnboardingPacketsClient heading="Vertical onboarding packets" />;
}
