import type { ReactNode } from "react";
import Link from "next/link";
import { SiteLogoLink } from "@/components/brand/site-logo-link";
import {
  isDownloadsMarketingEnabled,
  isRcLiteMarketingEnabled,
} from "@/lib/marketing-feature-flags";
import { MarketingBookAppointmentLink } from "@/components/marketing/marketing-book-appointment-link";
import {
  marketingDownloadsPath,
  marketingDevelopersRestApiDocsPath,
  marketingDevelopersApiPath,
  marketingOperationsStatusPath,
  marketingPressPath,
  marketingRcLitePath,
  marketingAcceptableUsePath,
  marketingCadPath,
  marketingContactPath,
  marketingCookiePolicyPath,
  marketingDesktopPath,
  marketingHomePath,
  marketingLoginPath,
  marketingPricingPath,
  marketingPrivacyPath,
  marketingSecurityPath,
  marketingTermsPath,
} from "@/lib/marketing-links";
import {
  SITE_NAME,
  SITE_OPERATOR_NAME,
  SITE_OPERATOR_URL,
  SITE_SLOGAN,
} from "@/lib/site";

const FOOTER_FOCUS_LINK_CLASS =
  "inline-flex min-h-8 items-center rounded-sm py-0.5 text-xs text-slate-400 outline-offset-2 transition-colors hover:text-sky-400 focus-visible:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 sm:min-h-7";

const FOOTER_LEGAL_NOTE =
  "Information on this website is provided for general informational purposes. Production use is governed by the applicable agency agreement, statement of work, policies, and local requirements.";

function FooterSectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
      {children}
    </p>
  );
}

/** Grouped footer for public marketing — no direct installer URLs; console login hidden on narrow viewports. */
export function MarketingFooter() {
  const login = marketingLoginPath();
  const home = marketingHomePath();
  const pricing = marketingPricingPath();
  const privacy = marketingPrivacyPath();
  const terms = marketingTermsPath();
  const cookies = marketingCookiePolicyPath();
  const acceptableUse = marketingAcceptableUsePath();
  const cad = marketingCadPath();
  const security = marketingSecurityPath();
  const contact = marketingContactPath();
  const desktop = marketingDesktopPath();
  const externalStatusHref = process.env.NEXT_PUBLIC_EXTERNAL_STATUS_PAGE_URL?.trim() || "";

  const rcLiteHref = marketingRcLitePath();
  const downloadsHref = marketingDownloadsPath();
  const apiDocsHref = marketingDevelopersRestApiDocsPath();
  const devHubHref = marketingDevelopersApiPath();
  const statusHref = marketingOperationsStatusPath();
  const pressHref = marketingPressPath();

  return (
    <footer className="safe-bottom border-t border-slate-800/90 bg-[#030712] py-6 text-xs text-slate-400 sm:py-7">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {/* Brand */}
          <div className="space-y-2 lg:col-span-3 xl:col-span-3">
            <SiteLogoLink
              href={home}
              heightClass="h-7 md:h-8"
              linkClassName="inline-flex shrink-0 opacity-[0.98]"
            />
            <p className="text-xs font-semibold leading-snug text-slate-200">{SITE_SLOGAN}</p>
            <p className="text-[11px] leading-snug text-slate-500">
              Real-time intelligent software for dispatchers, supervisors, and emergency response teams.
            </p>
            <p className="text-[10px] leading-snug text-slate-600">
              &copy; 2026 {SITE_NAME}. Decision support — not a replacement for CAD, telephony, or medical direction.
            </p>
            <p className="text-[10px] leading-snug text-slate-600">
              Built by{" "}
              <a
                href={SITE_OPERATOR_URL}
                className="rounded-sm text-slate-500 underline underline-offset-2 outline-offset-2 transition-colors hover:text-sky-400 focus-visible:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                target="_blank"
                rel="noopener noreferrer"
              >
                {SITE_OPERATOR_NAME}
              </a>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 xs:grid-cols-3 sm:grid-cols-3 lg:col-span-9 lg:grid-cols-5 lg:gap-x-5 lg:gap-y-4 xl:col-span-9">
            <nav className="min-w-0" aria-labelledby="footer-company-heading">
              <FooterSectionTitle id="footer-company-heading">Company</FooterSectionTitle>
              <ul className="mt-1.5 space-y-0.5">
                <li>
                  <Link href={pressHref} className={FOOTER_FOCUS_LINK_CLASS}>
                    Press
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="min-w-0" aria-labelledby="footer-platform-heading">
              <FooterSectionTitle id="footer-platform-heading">Platform</FooterSectionTitle>
              <ul className="mt-1.5 space-y-0.5">
                <li>
                  <Link href={home} className={FOOTER_FOCUS_LINK_CLASS}>
                    Home
                  </Link>
                </li>
                <li>
                  <Link href={pricing} className={FOOTER_FOCUS_LINK_CLASS}>
                    Plans
                  </Link>
                </li>
                <li>
                  <Link href={cad} className={FOOTER_FOCUS_LINK_CLASS}>
                    CAD Integration
                  </Link>
                </li>
                <li className="hidden md:list-item">
                  <Link href={desktop} className={FOOTER_FOCUS_LINK_CLASS}>
                    Desktop
                  </Link>
                </li>
                {isDownloadsMarketingEnabled() ? (
                  <li className="hidden md:list-item">
                    <Link href={downloadsHref} className={FOOTER_FOCUS_LINK_CLASS}>
                      Downloads
                    </Link>
                  </li>
                ) : null}
                {isRcLiteMarketingEnabled() ? (
                  <li className="hidden md:list-item">
                    <Link href={rcLiteHref} className={FOOTER_FOCUS_LINK_CLASS}>
                      RC Lite
                    </Link>
                  </li>
                ) : null}
              </ul>
            </nav>

            <nav className="min-w-0" aria-labelledby="footer-resources-heading">
              <FooterSectionTitle id="footer-resources-heading">Resources</FooterSectionTitle>
              <ul className="mt-1.5 space-y-0.5">
                <li>
                  <Link href={security} className={FOOTER_FOCUS_LINK_CLASS}>
                    Security
                  </Link>
                </li>
                <li>
                  {externalStatusHref ? (
                    <a href={externalStatusHref} className={FOOTER_FOCUS_LINK_CLASS} target="_blank" rel="noopener noreferrer">
                      Status
                    </a>
                  ) : (
                    <Link href={statusHref} className={FOOTER_FOCUS_LINK_CLASS}>
                      Status
                    </Link>
                  )}
                </li>
                <li>
                  <Link href={contact} className={FOOTER_FOCUS_LINK_CLASS}>
                    Contact
                  </Link>
                </li>
                <li>
                  <MarketingBookAppointmentLink className={FOOTER_FOCUS_LINK_CLASS}>
                    Book appointment
                  </MarketingBookAppointmentLink>
                </li>
                <li className="hidden md:list-item">
                  <Link href={apiDocsHref} className={FOOTER_FOCUS_LINK_CLASS}>
                    API Docs
                  </Link>
                </li>
                <li className="hidden md:list-item">
                  <Link href={`${devHubHref}/docs`} className={FOOTER_FOCUS_LINK_CLASS}>
                    Developer Guides
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="min-w-0" aria-labelledby="footer-legal-heading">
              <FooterSectionTitle id="footer-legal-heading">Legal</FooterSectionTitle>
              <ul className="mt-1.5 space-y-0.5">
                <li>
                  <Link href={privacy} className={FOOTER_FOCUS_LINK_CLASS}>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href={terms} className={FOOTER_FOCUS_LINK_CLASS}>
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href={cookies} className={FOOTER_FOCUS_LINK_CLASS}>
                    Cookies
                  </Link>
                </li>
                <li>
                  <Link href={acceptableUse} className={FOOTER_FOCUS_LINK_CLASS}>
                    Acceptable Use
                  </Link>
                </li>
                <li>
                  <Link href="/sms-consent" className={FOOTER_FOCUS_LINK_CLASS}>
                    SMS consent
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="min-w-0" aria-labelledby="footer-access-heading">
              <FooterSectionTitle id="footer-access-heading">Access</FooterSectionTitle>
              <ul className="mt-1.5 space-y-0.5">
                <li className="hidden md:list-item">
                  <Link href={login} className={FOOTER_FOCUS_LINK_CLASS}>
                    Agency Login
                  </Link>
                </li>
                <li className="md:hidden">
                  <p className="text-[10px] leading-snug text-slate-500">
                    Console access is restricted to approved desktop workstations.
                  </p>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <p className="mt-5 border-t border-slate-800/90 pt-4 text-[10px] leading-snug text-slate-600 sm:text-left">
          {FOOTER_LEGAL_NOTE}
        </p>
      </div>
    </footer>
  );
}
