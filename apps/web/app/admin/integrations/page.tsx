import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";

/** Alias for Nest/camera “Connect” links that omit the jurisdiction prefix. */
export default async function AdminIntegrationsAliasPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect(marketingLoginPath());
  redirect(`/${defaultJurisdictionSlug()}/admin/integrations`);
}
