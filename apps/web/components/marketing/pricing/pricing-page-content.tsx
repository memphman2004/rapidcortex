import Link from "next/link";
import { SiteLogoLink } from "@/components/brand/site-logo-link";
import { isPublicSignupUiEnabled } from "@/lib/auth/public-signup";
import { marketingDashboardPath, marketingHomePath, marketingLoginPath } from "@/lib/marketing-links";
import { PricingAddonGrid } from "./pricing-addon-grid";
import { PricingComparisonTable } from "./pricing-comparison-table";
import { PricingEnterpriseSection } from "./pricing-enterprise-section";
import { PricingFaq } from "./pricing-faq";
import { PricingFinalCta } from "./pricing-final-cta";
import { PricingHero } from "./pricing-hero";
import { PricingImplementationSection } from "./pricing-implementation-section";
import { PricingPaymentSection } from "./pricing-payment-section";
import { PricingPlanGrid } from "./pricing-plan-grid";
import { PricingRcLiteOnlySection } from "./pricing-rc-lite-only-section";
import { WatchDemoPricingLink } from "@/components/marketing/watch-demo-youtube";

export function PricingPageContent() {
  const home = marketingHomePath();
  const login = marketingLoginPath();
  const app = marketingDashboardPath();
  const signupEnabled = isPublicSignupUiEnabled();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <SiteLogoLink
        href={home}
        heightClass="h-24 max-h-[156px] w-auto object-contain sm:h-32 md:h-40"
        className="object-contain"
        linkClassName="mb-8 inline-flex max-w-[min(100%,280px)] shrink-0 md:mb-10"
        priority
      />
      <div className="w-full">
        <p className="text-xs text-slate-500">
          <Link href={home} className="text-sky-400/90 hover:text-sky-300">
            Home
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          <span className="text-slate-400">Plans</span>
        </p>
        <p className="mt-3">
          <WatchDemoPricingLink />
        </p>

        <div className="mt-8">
          <PricingHero />
        </div>

        <div className="mt-10 hidden w-full rounded-xl border border-slate-700/70 bg-slate-900/35 p-6 text-center md:block sm:p-8">
          <p className="text-sm font-medium text-white">Rapid Cortex (full dashboard) vs RC Lite (API‑only)</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-400">
            Platform ECC plans are procured separately from RC Lite intelligence API access. Rapid Cortex is sold through agency
            contracts, approved pilots, purchase orders, invoices, and authorized procurement workflows.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact-sales"
              className="inline-flex rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Contact Support
            </Link>
            <Link
              href="/rc-lite"
              className="inline-flex rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800/70"
            >
              Request RC Lite Access
            </Link>
            <Link
              href="/contact-sales"
              className="inline-flex rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/70"
            >
              Request pilot
            </Link>
          </div>
        </div>

        <PricingPlanGrid />
        <div className="hidden md:block">
          <PricingRcLiteOnlySection />
        </div>
        <PricingComparisonTable />
        <PricingPaymentSection />
        <PricingAddonGrid />
        <PricingImplementationSection />
        <PricingEnterpriseSection />
        <PricingFaq />
        <PricingFinalCta />

        <div className="mt-12 w-full rounded-xl border border-slate-800 bg-slate-900/25 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-white">Already working with us?</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Sign in to your jurisdiction workspace and open the live app — the operations manual is
            available from the top bar after you sign in.
          </p>
          <p className="mt-4 text-xs text-slate-500 md:hidden">
            Rapid Cortex console access is available from approved desktop workstations only.
          </p>
          <div className="mt-5 hidden flex-wrap gap-3 md:flex">
            {signupEnabled ? (
              <Link
                href="/signup"
                className="inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Sign up
              </Link>
            ) : null}
            <Link
              href={login}
              className="inline-flex rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              Sign in
            </Link>
            <Link href={app} className="inline-flex text-sm text-sky-400/90 hover:text-sky-300">
              Open app →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
