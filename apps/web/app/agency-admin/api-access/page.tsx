import { redirect } from "next/navigation";
import { AgencyApiAccessPanel } from "@/components/agency-admin/agency-api-access-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Agency API clients",
  robots: { index: false, follow: false },
};

export default async function AgencyAdminApiAccessPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect(`${marketingLoginPath()}?from=/agency-admin/api-access`);
  return <AgencyApiAccessPanel initialUser={user} />;
}
