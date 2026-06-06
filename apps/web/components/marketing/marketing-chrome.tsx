"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingMobileStickyDemoCta } from "@/components/marketing/marketing-mobile-sticky-demo-cta";

/** Full marketing chrome — skipped on standalone splash routes like `/enter`. */
export function MarketingChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/enter") {
    return <>{children}</>;
  }

  return (
    <>
      <MarketingHeader />
      <main className="relative z-0 w-full pb-[max(6rem,calc(5rem+env(safe-area-inset-bottom)))] pt-0 sm:pb-10 md:pb-12">
        {children}
      </main>
      <MarketingMobileStickyDemoCta />
      <MarketingFooter />
    </>
  );
}
