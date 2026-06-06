"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { marketingDemoRequestPath } from "@/lib/marketing-links";

/**
 * Fixed mobile-only demo request CTA (centered, not right-edge).
 * Avoid placing FABs on the right at ~60–75% height — iPhone 16/17 Camera Control.
 */
export function MarketingMobileStickyDemoCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-7xl justify-center px-4">
        <Link
          href={marketingDemoRequestPath("demo")}
          className="inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-base font-semibold text-slate-950 shadow-[0_12px_32px_-8px_rgba(14,165,233,0.45)] transition hover:from-sky-400 hover:to-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          <FileText className="size-4 shrink-0" aria-hidden />
          Request a demo
        </Link>
      </div>
    </div>
  );
}
