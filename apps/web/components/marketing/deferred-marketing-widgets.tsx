"use client";

import dynamic from "next/dynamic";

const MarketingMobileStickyDemoCta = dynamic(
  () =>
    import("@/components/marketing/marketing-mobile-sticky-demo-cta").then((m) => ({
      default: m.MarketingMobileStickyDemoCta,
    })),
  { ssr: false },
);

/** Below-fold marketing chrome — kept out of the initial venue LCP path. */
export function DeferredMarketingWidgets() {
  return <MarketingMobileStickyDemoCta />;
}
