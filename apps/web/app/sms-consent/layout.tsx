import { Providers } from "@/app/providers";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

/**
 * Public SMS consent — **not** under `(marketing)/` so this literal segment wins over
 * `app/[jurisdiction]/page.tsx` (which would otherwise treat `sms-consent` as a workspace slug).
 */
export default function SmsConsentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const orgJsonLd = buildOrganizationJsonLd();
  const websiteJsonLd = buildWebsiteJsonLd();
  return (
    <Providers>
      <div className="flex min-h-full min-h-dvh flex-col bg-slate-950/78 backdrop-blur-md">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      </div>
    </Providers>
  );
}
