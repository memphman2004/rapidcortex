import Link from "next/link";
import { redirect } from "next/navigation";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { SmsRoutingManager } from "@/components/sms-routing/sms-routing-manager";
import { fetchAgency } from "@/lib/api";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { reportVerticalForAgency } from "@/lib/qr-nfc/report-vertical";
import { smsRoutingPermissions } from "@/lib/sms-routing/access";
import { deriveVerticalFromAgencyId } from "@/lib/vertical";

export const metadata = {
  title: "SMS Numbers (RC Admin)",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ agencyId: string }> };

export default async function RcAdminAgencySmsNumbersPage({ params }: Props) {
  const { agencyId } = await params;
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/agencies/${encodeURIComponent(agencyId)}/sms-numbers`);
  }

  const perms = smsRoutingPermissions(user, agencyId);
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

  const defaultVertical =
    vertical === "venue" ? "venue" : vertical === "campus" ? "campus" : "911";

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">SMS Numbers — {agencyName}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Register the Twilio number printed on signs and QR/NFC collateral. Students text this number;
          routing uses the destination number only.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/rc-admin/agencies" className="text-sky-400 hover:text-sky-300">
            ← Agencies
          </Link>
          <Link
            href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/qr-codes`}
            className="text-sky-400 hover:text-sky-300"
          >
            QR codes →
          </Link>
        </div>
      </div>
      <SmsRoutingManager
        agencyId={agencyId}
        agencyName={agencyName}
        defaultVertical={defaultVertical}
        canManage={perms.canManage}
      />
    </div>
  );
}
