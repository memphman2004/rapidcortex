import { redirect } from "next/navigation";
import { RcAdminApiClientsPanel } from "@/components/rc-admin/rc-admin-api-clients-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Integration API oversight",
  robots: { index: false, follow: false },
};

export default async function RcAdminApiClientsPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect(`${marketingLoginPath()}?from=/rc-admin/api-clients`);
  return <RcAdminApiClientsPanel user={user} />;
}
