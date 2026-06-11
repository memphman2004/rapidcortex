import { QRNFCManager } from "@/components/qr-nfc/qr-nfc-manager";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { qrCodePermissions } from "@/lib/qr-nfc/access";
import { redirect } from "next/navigation";

export default async function RcAdminQrNfcPage() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role)) redirect("/login");
  const perms = qrCodePermissions(user, user.agencyId);
  if (!perms.canView) redirect("/rc-admin");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="mb-4 text-sm text-slate-400">
        All QR codes across agencies. Filter by vertical or open a tenant from{" "}
        <a href="/rc-admin/agencies" className="text-sky-400 hover:text-sky-300">
          Agencies
        </a>
        .
      </p>
      <QRNFCManager
        agencyId={user.agencyId}
        vertical="911"
        canCreate={perms.canCreate}
        canDeactivate={perms.canDeactivate}
        canDownload={perms.canDownload}
        globalView
      />
    </div>
  );
}
