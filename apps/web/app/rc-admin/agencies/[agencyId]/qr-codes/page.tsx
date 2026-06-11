import Link from "next/link";
import { redirect } from "next/navigation";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { QRNFCManager } from "@/components/qr-nfc/qr-nfc-manager";
import { fetchAgency } from "@/lib/api";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { qrCodePermissions } from "@/lib/qr-nfc/access";
import { reportVerticalForAgency } from "@/lib/qr-nfc/report-vertical";
import { deriveVerticalFromAgencyId } from "@/lib/vertical";

export const metadata = {
  title: "QR Codes (RC Admin)",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ agencyId: string }> };

export default async function RcAdminAgencyQrCodesPage({ params }: Props) {
  const { agencyId } = await params;
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/agencies/${encodeURIComponent(agencyId)}/qr-codes`);
  }

  const perms = qrCodePermissions(user, agencyId);
  if (!perms.canView) redirect("/rc-admin");

  let agencyName = agencyId;
  let vertical = reportVerticalForAgency(agencyId);
  try {
    const agency = await fetchAgency(agencyId);
    agencyName = agency.name ?? agencyId;
    const rawVertical = (agency as { vertical?: string }).vertical;
    vertical = reportVerticalForAgency(agencyId, rawVertical ?? deriveVerticalFromAgencyId(agencyId));
  } catch {
    // keep fallbacks
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">QR Codes — {agencyName}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Named reporting links for this agency. Citizens scan or tap to open the public intake form — no login
          required.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/rc-admin/agencies" className="text-sky-400 hover:text-sky-300">
            ← Agencies
          </Link>
          <Link
            href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/features`}
            className="text-sky-400 hover:text-sky-300"
          >
            Feature add-ons →
          </Link>
          <Link href="/rc-admin/qr-nfc" className="text-sky-400 hover:text-sky-300">
            All QR codes →
          </Link>
          <Link
            href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/sms-numbers`}
            className="text-sky-400 hover:text-sky-300"
          >
            SMS numbers →
          </Link>
        </div>
      </div>
      <QRNFCManager
        agencyId={agencyId}
        agencyName={agencyName}
        vertical={vertical}
        canCreate={perms.canCreate}
        canDeactivate={perms.canDeactivate}
        canDownload={perms.canDownload}
        zoneLabel="Zone / Location"
      />
    </div>
  );
}
