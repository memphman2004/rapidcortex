import { redirect } from "next/navigation";
import { canAccessRapidIq } from "rapid-cortex-shared";
import { ConferencesClient } from "@/components/conferences/conferences-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isConferencesUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Conferences",
  robots: { index: false, follow: false },
};

export default async function RcAdminConferencesPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIq(user.role) || !isConferencesUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/conferences`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Conferences</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Track APCO, NENA, and other public-safety events. A weekly job fetches each enabled
          website, extracts dates with Claude, and flags confirmed or likely changes for review.
        </p>
      </div>
      <ConferencesClient />
    </div>
  );
}
