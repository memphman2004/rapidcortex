import { QRNFCManager } from "@/components/qr-nfc/qr-nfc-manager";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { qrCodePermissions } from "@/lib/qr-nfc/access";
import { redirect } from "next/navigation";

export default async function AgencyAdminQrCodesPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  const perms = qrCodePermissions(user, user.agencyId);
  if (!perms.canView) redirect("/unauthorized");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <QRNFCManager
        agencyId={user.agencyId}
        vertical="911"
        canCreate={perms.canCreate}
        canDeactivate={perms.canDeactivate}
        canDownload={perms.canDownload}
        zoneLabel="Zone / Location"
      />
    </div>
  );
}
