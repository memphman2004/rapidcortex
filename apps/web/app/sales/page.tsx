import { redirect } from "next/navigation";
import { SalesPortalShell } from "@/components/sales/sales-portal-shell";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { canViewPipeline, earningsScopedToSelf } from "@/lib/sales/sales-authz";

export const metadata = {
  title: "Sales Portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SalesPortalPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    redirect(`${marketingLoginPath()}?from=/sales`);
  }

  const email = user.email ?? user.userId ?? "";
  const name = user.displayName ?? email;
  const assigneeFilter = earningsScopedToSelf(user) ? email : undefined;

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6">
      <SalesPortalShell
        contractorEmail={email}
        contractorName={name}
        assigneeFilter={assigneeFilter}
      />
    </div>
  );
}
