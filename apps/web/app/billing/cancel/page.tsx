import Link from "next/link";

export const metadata = {
  title: "Procurement request not completed",
  robots: { index: false, follow: false },
};

export default function BillingCancelPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <h1 className="text-3xl font-semibold text-white">Request not completed</h1>
        <p className="mt-3 text-sm text-slate-300">
          Rapid Cortex does not process public self-service card payments. Continue with your agency procurement lead or
          contact Rapid Cortex for invoice, pilot, and purchase-order options.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/billing/checkout" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
            Return to billing summary
          </Link>
          <Link href="/contact-sales" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  );
}
