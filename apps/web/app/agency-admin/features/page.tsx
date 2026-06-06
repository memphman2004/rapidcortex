import { redirect } from "next/navigation";
import { AgencyEntitlementsPanel } from "@/components/agency-admin/agency-entitlements-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Features & add-ons",
  robots: { index: false, follow: false },
};

export default async function AgencyFeaturesPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect(`${marketingLoginPath()}?from=/agency-admin/features`);
  return <AgencyEntitlementsPanel />;
}
