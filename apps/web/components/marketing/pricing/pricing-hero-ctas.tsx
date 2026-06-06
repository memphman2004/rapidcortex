"use client";

import Link from "next/link";
import { marketingContactSalesPath, marketingDemoRequestPath } from "@/lib/marketing-links";
import { usePricingDemoModal } from "./pricing-demo-modal-context";

export function PricingHeroCtas() {
  const { openDemo } = usePricingDemoModal();

  return (
    <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
      <Link
        href={marketingDemoRequestPath("demo")}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-950/25 transition hover:bg-sky-500 sm:w-auto sm:text-sm md:hidden"
      >
        Request a demo
      </Link>
      <button
        type="button"
        onClick={openDemo}
        className="hidden min-h-[44px] items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/25 transition hover:bg-sky-500 md:inline-flex"
      >
        Request Demo
      </button>
      <Link
        href={marketingContactSalesPath()}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-600 bg-slate-950/40 px-6 py-3 text-base font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900/60 sm:w-auto sm:text-sm"
      >
        Contact our Support Team
      </Link>
      <Link
        href="/rc-lite"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-sky-500/35 bg-sky-950/40 px-6 py-3 text-base font-semibold text-sky-100 transition hover:border-sky-400/50 hover:bg-sky-950/70 sm:w-auto sm:text-sm"
      >
        Get RC Lite
      </Link>
    </div>
  );
}
