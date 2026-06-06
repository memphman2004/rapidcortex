import Link from "next/link";

export const metadata = { title: "RC Lite — billing", robots: { index: false, follow: false } };

export default function RcLitePortalBillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">RC Lite billing</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        RC Lite is API-only — access is awarded separately from Rapid Cortex dashboard seat plans. Government customers
        typically use pilots, purchase orders, invoicing, and Net terms tracked in agency records. Rapid Cortex is sold
        through agency contracts and approved procurement workflows.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/rc-lite/checkout"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Request Pilot Access
        </Link>
        <Link
          href="/contact-sales?interest=api_access"
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
        >
          Request Procurement Review
        </Link>
      </div>
    </div>
  );
}
