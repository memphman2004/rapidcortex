"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/marketing-header";

const MarketingFooter = dynamic(() =>
  import("@/components/marketing/marketing-footer").then((m) => ({ default: m.MarketingFooter })),
);
const MarketingMobileStickyDemoCta = dynamic(
  () =>
    import("@/components/marketing/marketing-mobile-sticky-demo-cta").then((m) => ({
      default: m.MarketingMobileStickyDemoCta,
    })),
  { ssr: false },
);

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
