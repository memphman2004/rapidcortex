import { requireRole } from "@/lib/auth/require-role";
import PlatformAuditPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/audit/page";

export const metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

export default async function RcAdminAuditPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <PlatformAuditPage />;
}
