import { redirect } from "next/navigation";
import { AccessOverridesManager } from "@/components/agency-admin/access-overrides-manager";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Access overrides",
  robots: { index: false, follow: false },
};

export default async function AgencyAdminAccessOverridesPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect(`${marketingLoginPath()}?from=/agency-admin/overrides`);

  return <AccessOverridesManager initialUser={user} />;
}
