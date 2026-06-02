import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingMobileStickyDemoCta } from "@/components/marketing/marketing-mobile-sticky-demo-cta";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

/** Avoid right-edge FABs at ~60–75% viewport height (iPhone 16/17 Camera Control). */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const orgJsonLd = buildOrganizationJsonLd();
  const websiteJsonLd = buildWebsiteJsonLd();
  return (
    <div className="foldable-safe flex min-h-full min-h-dvh flex-col bg-slate-950/78 backdrop-blur-md">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <MarketingHeader />
      <main className="flex-1 pb-[max(6rem,calc(5rem+env(safe-area-inset-bottom)))] pt-1 sm:pb-10 md:pb-12">
        {children}
      </main>
      <MarketingMobileStickyDemoCta />
      <MarketingFooter />
    </div>
  );
}
