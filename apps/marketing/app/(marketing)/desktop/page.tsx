import Link from "next/link";
import type { Metadata } from "next";
import {
  marketingDashboardPath,
  marketingLoginPath,
  marketingPricingPath,
} from "@/lib/marketing-links";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";

const PRESS_EMAIL = "info@rapidcortex.us";
const FOUNDED_YEAR = 2025;

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Desktop | Rapid Cortex Public Safety Workstations",
  description: `${SITE_NAME} Desktop for Mac and Windows — a product of ${SITE_OPERATOR_NAME}, founded in ${FOUNDED_YEAR}. Same role dashboards as the web app for seamless workstation access.`,
  path: "/desktop",
});

export default function MarketingDesktopPage() {
  const pricing = marketingPricingPath();
  const login = marketingLoginPath();
  const app = marketingDashboardPath();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
        {SITE_NAME} Desktop · Product of {SITE_OPERATOR_NAME}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Desktop apps for your agency
      </h1>
      <p className="mt-5 text-pretty text-lg leading-relaxed text-slate-300">
        {SITE_NAME} Desktop is available for{" "}
        <strong className="font-medium text-slate-200">Mac</strong> and{" "}
        <strong className="font-medium text-slate-200">Windows</strong>. It is a product of{" "}
        <a
          href={SITE_OPERATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sky-300 hover:text-sky-200"
        >
          {SITE_OPERATOR_NAME}
        </a>
        , founded in {FOUNDED_YEAR}, built for{" "}
        <strong className="font-medium text-slate-200">dispatch workstations</strong> and{" "}
        <strong className="font-medium text-slate-200">agency-controlled deployment</strong>.
      </p>

      <section className="mt-10 rounded-xl border border-sky-800/40 bg-sky-950/20 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-white">Same dashboards. Seamless experience.</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Desktop loads the <strong className="font-medium text-slate-100">same Rapid Cortex web
          workspace</strong> your team already uses in the browser — the same role dashboards,
          navigation, Media / Ring Connect, and Operations Manual. Sign in once on the workstation;
          what you see on desktop matches what you see on the web so training and muscle memory stay
          consistent across every seat.
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-300">
          <li>Identical dispatcher, supervisor, admin, campus, venue, and hospital role dashboards</li>
          <li>Same live incident tools, side navigation, and product features as{" "}
            <span className="font-mono text-slate-400">app.rapidcortex.us</span>
          </li>
          <li>Native shell for Mac (WKWebView) and Windows (WebView2) — not a separate UI fork</li>
        </ul>
      </section>

      <ul className="mt-8 list-inside list-disc space-y-2 text-slate-300">
        <li>
          Requires an <strong className="font-medium text-slate-200">authorized {SITE_NAME} account</strong>.
        </li>
        <li>
          Installers (<span className="font-mono text-slate-400">.dmg</span>,{" "}
          <span className="font-mono text-slate-400">.exe</span>,{" "}
          <span className="font-mono text-slate-400">.msi</span>) are{" "}
          <strong className="font-medium text-slate-200">not publicly downloadable</strong> from this
          page. They are issued through authenticated agency admin flows with short-lived signed links.
        </li>
        <li>
          After install, users must <strong className="font-medium text-slate-200">sign in</strong>{" "}
          before accessing any incident data.
        </li>
      </ul>

      <dl className="mt-10 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</dt>
          <dd className="mt-1 text-slate-200">{SITE_NAME} Desktop</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator</dt>
          <dd className="mt-1 text-slate-200">{SITE_OPERATOR_NAME}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Founded</dt>
          <dd className="mt-1 text-slate-200">{FOUNDED_YEAR}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Press contact</dt>
          <dd className="mt-1">
            <a href={`mailto:${PRESS_EMAIL}`} className="text-sky-300 hover:text-sky-200">
              {PRESS_EMAIL}
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={pricing}
          className="inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 sm:w-auto"
        >
          Request Pilot Access
        </Link>
        <Link
          href={login}
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-600 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-800/60 sm:w-auto"
        >
          Agency Login
        </Link>
        <Link
          href={app}
          className="inline-flex w-full items-center justify-center rounded-md px-6 py-3 text-sm font-medium text-slate-400 hover:text-slate-200 sm:w-auto"
        >
          Open web app →
        </Link>
      </div>
    </div>
  );
}
