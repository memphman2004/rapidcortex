import { MarketingHeader } from "@/components/marketing/marketing-header";
import { DeferredMarketingWidgets } from "@/components/marketing/deferred-marketing-widgets";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

/** Avoid right-edge FABs at ~60–75% viewport height (iPhone 16/17 Camera Control). */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const orgJsonLd = buildOrganizationJsonLd();
  const websiteJsonLd = buildWebsiteJsonLd();
  return (
    <div className="marketing-site foldable-safe flex min-h-dvh flex-col overflow-x-hidden bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <MarketingHeader />
      <main className="relative z-0 w-full pb-[max(6rem,calc(5rem+env(safe-area-inset-bottom)))] pt-0 sm:pb-10 md:pb-12">
        {children}
      </main>
      <DeferredMarketingWidgets />
      <MarketingFooter />
    </div>
  );
}
