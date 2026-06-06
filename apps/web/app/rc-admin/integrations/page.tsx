import { requireRole } from "@/lib/auth/require-role";
import PlatformIntegrationsPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/integrations/page";

export const metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
};

export default async function RcAdminIntegrationsPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <PlatformIntegrationsPage />;
}
