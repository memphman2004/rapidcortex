import Link from "next/link";
import type { Metadata } from "next";

import {
  marketingDemoRequestPath,
  marketingContactPath,
  marketingDevelopersRestApiDocsPath,
  marketingLoginPath,
  marketingRcLitePath,
} from "@/lib/marketing-links";
import { WatchDemoDownloadsLink } from "@/components/marketing/watch-demo-youtube";
import { buildPublicPageMetadata } from "@/lib/seo";

const MAC_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL?.trim() || "https://downloads.rapidcortex.us/mac/latest/RapidCortex.dmg";

const WINDOWS_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL?.trim() ||
  "https://downloads.rapidcortex.us/windows/latest/RapidCortexSetup.exe";

function rcLiteDocsUrl(): string {
  const configured = process.env.NEXT_PUBLIC_RC_LITE_DOCS_URL?.trim();
  if (configured) return configured;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rel = marketingDevelopersRestApiDocsPath();
  return site ? `${site.replace(/\/$/, "")}${rel}` : rel;
}

const CUSTOMER_LOGIN_PATH = marketingLoginPath();
const CONTACT_PATH = marketingContactPath();
const RC_LITE_MARKETING = marketingRcLitePath();

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Downloads | Rapid Cortex Public Safety Platform",
  description:
    "Access Rapid Cortex desktop installers, integration resources, and authorized customer distribution links for emergency communications and public safety operations.",
  path: "/downloads",
});

export default function DownloadsPage() {
  const rcLiteDocsHref = rcLiteDocsUrl();

  return (
    <div className="min-h-full bg-slate-950 px-4 py-14 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400/90">Rapid Cortex</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Rapid Cortex Downloads
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-pretty text-lg text-slate-300">
            Desktop installers, RC Lite references, and customer sign-in shortcuts. Updates and installer distribution
            for authorized workstations are coordinated with your agency&apos;s Rapid Cortex administrators.
          </p>
          <p className="mt-5">
            <WatchDemoDownloadsLink />
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-8 shadow-xl shadow-black/40">
            <h2 className="text-xl font-semibold text-white">Rapid Cortex Desktop — Mac</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              macOS installer access for approved Rapid Cortex desktop deployments.
            </p>
            <a
              href={MAC_DOWNLOAD_URL}
              className="mt-6 inline-flex rounded-md bg-sky-600 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Download for Mac
            </a>
            <p className="mt-4 text-xs text-slate-500">
              Requires Rapid Cortex authorization and secure agency sign-in.
            </p>
          </article>

          <article className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-8 shadow-xl shadow-black/40">
            <h2 className="text-xl font-semibold text-white">Rapid Cortex Desktop — Windows</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Windows installer access for approved Rapid Cortex desktop deployments.
            </p>
            <a
              href={WINDOWS_DOWNLOAD_URL}
              className="mt-6 inline-flex rounded-md bg-sky-600 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Download for Windows
            </a>
            <p className="mt-4 text-xs text-slate-500">
              Requires Rapid Cortex authorization and secure agency sign-in.
            </p>
          </article>

          <article className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-8 shadow-xl shadow-black/40">
            <h2 className="text-xl font-semibold text-white">RC Lite</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              API-first access for approved partners and agencies that need lightweight integration with Rapid Cortex
              intelligence services.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={rcLiteDocsHref}
                className="inline-flex rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Developers &amp; API docs
              </a>
              <Link
                href={RC_LITE_MARKETING}
                className="inline-flex rounded-md border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
              >
                RC Lite overview
              </Link>
            </div>
          </article>

          <article className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-8 shadow-xl shadow-black/40">
            <h2 className="text-xl font-semibold text-white">Agency Console Access</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Authorized agency users can access the secure Rapid Cortex console from approved desktop workstations.
            </p>
            <Link
              href={marketingDemoRequestPath("demo")}
              className="mt-6 inline-flex rounded-md bg-sky-600 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-500 md:hidden"
            >
              Request a demo
            </Link>
            <Link
              href={CUSTOMER_LOGIN_PATH}
              className="mt-6 hidden rounded-md bg-sky-600 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-500 md:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href={CONTACT_PATH}
              className="mt-6 ml-0 inline-flex rounded-md border border-slate-600 px-8 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 sm:ml-3"
            >
              Contact us
            </Link>
          </article>
        </div>

        <div className="rounded-lg border border-sky-800/70 bg-sky-950/40 p-6 text-sm text-slate-200">
          <strong className="text-sky-200">Security</strong> — downloads and programmatic access target authorized Rapid
          Cortex customers only. Prefer short-lived URLs and agency policy for workstation installers.
        </div>
      </div>
    </div>
  );
}
