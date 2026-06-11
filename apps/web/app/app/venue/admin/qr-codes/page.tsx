import Link from "next/link";
import { QRNFCManager } from "@/components/qr-nfc/qr-nfc-manager";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { qrCodePermissions } from "@/lib/qr-nfc/access";
import { redirect } from "next/navigation";

export default async function VenueAdminQrCodesPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  const perms = qrCodePermissions(user, user.agencyId);
  if (!perms.canView) redirect("/unauthorized");
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/app/venue/admin/sms-numbers" className="text-sky-400 hover:text-sky-300">
          SMS numbers →
        </Link>
      </div>
      <QRNFCManager
        agencyId={user.agencyId}
        vertical="venue"
        canCreate={perms.canCreate}
        canDeactivate={perms.canDeactivate}
        canDownload={perms.canDownload}
        zoneLabel="Section / Gate / Level"
      />
    </div>
  );
}
