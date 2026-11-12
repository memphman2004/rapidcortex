import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Events & Outreach",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EventsOutreachPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/events`);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Events & Outreach</h1>
        <p className="mt-1 text-sm text-slate-400">
          Conferences, trade shows, NFC badge scans, and campaign-generated opportunities.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-2 text-base font-semibold text-white">Conferences & Trade Shows</h2>
          <p className="mb-4 text-sm text-slate-400">
            Track upcoming and past conferences, manage attendance records, and capture leads from
            booth NFC scans.
          </p>
          <Link
            href="/rc-admin/conferences"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700/20 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-700/40"
          >
            Open Conferences →
          </Link>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-2 text-base font-semibold text-white">NFC & QR Outreach Cards</h2>
          <p className="mb-4 text-sm text-slate-400">
            Business cards and demo booth QR codes that capture lead data and attribute scans to
            events and contacts.
          </p>
          <Link
            href="/rc-admin/admin/nfc-cards"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700/20 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-700/40"
          >
            Open NFC Cards →
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-slate-500">
          Event-attributed lead pipeline and ROI reports coming in Phase 2.
        </p>
      </div>
    </div>
  );
}
