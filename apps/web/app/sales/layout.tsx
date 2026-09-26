import { redirect } from "next/navigation";
import { SalesWorkspaceShell } from "@/components/sales/sales-workspace-shell";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { JurisdictionProvider } from "@/lib/jurisdiction-context";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { defaultJurisdictionSlug, marketingLoginPath } from "@/lib/marketing-links";

export const dynamic = "force-dynamic";

/** Sales shell with role nav — shared across portal + sales-only catalog pages. */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    redirect(`${marketingLoginPath()}?from=/sales`);
  }

  return (
    <JurisdictionProvider slug={defaultJurisdictionSlug()}>
      <SalesWorkspaceShell user={user}>{children}</SalesWorkspaceShell>
    </JurisdictionProvider>
  );
}
