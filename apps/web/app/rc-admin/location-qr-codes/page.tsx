import { RcAdminQrPanel } from "@/components/rc-admin/rc-admin-qr-panel";
import { requireRole } from "@/lib/auth/require-role";

export default async function RcAdminLocationQrCodesPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <RcAdminQrPanel />;
}
