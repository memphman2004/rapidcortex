import { redirect } from "next/navigation";
import { AgencyBillingPanel } from "@/components/agency-admin/agency-billing-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Agency billing",
  robots: { index: false, follow: false },
};

export default async function AgencyBillingPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect(`${marketingLoginPath()}?from=/agency-admin/billing`);
  return <AgencyBillingPanel initialUser={user} />;
}
