import { RcInternalOperationsHub } from "@/components/admin/rc-internal-operations-hub";
import { requireSuperAdmin } from "@/lib/auth/require-role";

export default async function RcAdminOperationsPage() {
  await requireSuperAdmin();
  return <RcInternalOperationsHub />;
}
