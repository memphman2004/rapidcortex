import { requireRole } from "@/lib/auth/require-role";
import PlatformOnboardingPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/onboarding/page";

export const metadata = {
  title: "Onboarding pipeline",
  robots: { index: false, follow: false },
};

export default async function RcAdminOnboardingPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <PlatformOnboardingPage />;
}
