import { SalesTerritoriesSettings } from "@/components/rc-admin/sales-territories-settings";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Sales territories",
  robots: { index: false, follow: false },
};

export default async function RcAdminSalesTerritoriesPage() {
  await requireRole(["rcsuperadmin", "rcadmin"]);

  return (
    <div className="space-y-6">
      <SalesTerritoriesSettings />
    </div>
  );
}
