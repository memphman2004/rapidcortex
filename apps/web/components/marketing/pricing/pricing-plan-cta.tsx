"use client";

import Link from "next/link";
import type { PricingPlanCardContent } from "@/lib/marketing/pricing-content";
import { usePricingDemoModal } from "./pricing-demo-modal-context";

const baseOutline =
  "inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition";

export function PricingPlanCta({ plan }: { plan: PricingPlanCardContent }) {
  const { openDemo } = usePricingDemoModal();

  if (plan.ctaKind === "contact_sales") {
    return (
      <Link
        href="/contact-sales"
        className={`${baseOutline} border border-slate-600 bg-slate-950/50 text-white hover:border-slate-500 hover:bg-slate-800/60`}
      >
        Contact Support
      </Link>
    );
  }

  if (plan.ctaKind === "request_rc_lite") {
    return (
      <Link
        href="/contact-sales?interest=api_access"
        className={`${baseOutline} border border-sky-500/40 bg-sky-950/40 text-white hover:bg-sky-950/70`}
      >
        Request RC Lite Access
      </Link>
    );
  }

  if (plan.ctaKind === "request_pilot") {
    return (
      <Link
        href="/contact-sales?interest=pilot_program"
        className={`${baseOutline} bg-sky-600 text-white shadow-sm shadow-sky-950/30 hover:bg-sky-500`}
      >
        Request Pilot
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={openDemo}
      className={`${baseOutline} bg-sky-600 text-white shadow-sm shadow-sky-950/30 hover:bg-sky-500`}
    >
      Request Demo
    </button>
  );
}
