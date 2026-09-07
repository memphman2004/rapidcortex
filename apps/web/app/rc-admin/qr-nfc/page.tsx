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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-4 text-sm text-slate-400">
        All QR &amp; NFC codes across agencies.{" "}
        <a href="#qr-nfc-usage" className="text-sky-400 hover:text-sky-300">
          Usage
        </a>{" "}
        tracks every QR-initiated website click — location report codes, Location QR (RCLI), and
        Rapid Cortex site signs — plus NFC taps. Use{" "}
        <a href="#rc-marketing-qr" className="text-amber-300 hover:text-amber-200">
          Rapid Cortex site QR
        </a>{" "}
        for booth signs that open www.rapidcortex.us. Location codes are for campus, venue, and
        agency report signs. Use the QR / NFC toggle to focus each medium, or open a tenant from{" "}
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
        showSiteQr
      />
    </div>
  );
}
