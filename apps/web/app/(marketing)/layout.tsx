import { MarketingChrome } from "@/components/marketing/marketing-chrome";
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
      <MarketingChrome>{children}</MarketingChrome>
    </div>
  );
}
