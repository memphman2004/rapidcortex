import Link from "next/link";
import { SiteLogoMark } from "@/components/brand/site-logo-link";

export const metadata = {
  title: "Procurement acknowledgement",
  robots: { index: false, follow: false },
};

export default function BillingSuccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="mb-4 flex justify-center">
          <SiteLogoMark heightClass="h-16" />
        </div>
        <h1 className="text-3xl font-semibold text-white">Request received</h1>
        <p className="mt-3 text-sm text-slate-300">
          Rapid Cortex will align entitlements with your agency contract, pilot, or purchase order. You will receive next
          steps from your Rapid Cortex liaison.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Rapid Cortex does not process public self-service card payments. Billing follows approved procurement workflows.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/agency-admin/billing" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
            Agency billing
          </Link>
          <Link href="/rc-lite/portal/billing" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            RC Lite billing
          </Link>
        </div>
      </div>
    </main>
  );
}
