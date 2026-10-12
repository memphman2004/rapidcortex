import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";

/**
 * Legacy /help entry — send signed-in users to the in-app Document Library.
 * (docs.rapidcortex.us is not provisioned; avoid /docs/help HTML redirects.)
 */
export default async function HelpIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`${marketingLoginPath()}?from=/help`);
  }

  const sp = await searchParams;
  const role = (sp.role ?? user.role ?? "").trim().toLowerCase().replace(/-/g, "_");

  if (role === "salescontractor" || role === "sales_contractor") {
    redirect("/sales/document-library");
  }
  if (role === "rcsuperadmin" || role === "rcadmin" || role === "rcitadmin") {
    redirect("/rc-admin/document-library");
  }
  if (role === "agencyadmin" || role === "agencyit") {
    redirect(`/${defaultJurisdictionSlug()}/admin/document-library`);
  }

  redirect(`/${defaultJurisdictionSlug()}/document-library`);
}
