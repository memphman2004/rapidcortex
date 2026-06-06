"use client";

import Link from "next/link";
import { marketingContactSalesPath, marketingDemoRequestPath } from "@/lib/marketing-links";
import { usePricingDemoModal } from "./pricing-demo-modal-context";

export function PricingFinalCtaButtons() {
  const { openDemo } = usePricingDemoModal();

  return (
    <div className="flex w-full max-w-md flex-col gap-3 sm:mx-auto sm:flex-row sm:justify-center">
      <Link
        href={marketingDemoRequestPath("demo")}
        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-500 md:hidden"
      >
        Request a demo
      </Link>
      <button
        type="button"
        onClick={openDemo}
        className="hidden min-h-[44px] flex-1 items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-500 md:inline-flex"
      >
        Request Demo
      </button>
      <Link
        href={marketingContactSalesPath()}
        className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-500 bg-slate-950/50 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-400 hover:bg-slate-900/70"
      >
        Contact our Support Team
      </Link>
    </div>
  );
}
