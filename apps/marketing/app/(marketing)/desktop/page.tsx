import Link from "next/link";
import type { Metadata } from "next";
import { marketingDashboardPath, marketingLoginPath, marketingPricingPath } from "@/lib/marketing-links";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Desktop | Rapid Cortex Public Safety Workstations",
  description:
    "Rapid Cortex desktop applications for Mac and Windows support agency-managed deployment, secure workstation access, and operational continuity for emergency communications teams.",
  path: "/desktop",
});

export default function MarketingDesktopPage() {
  const pricing = marketingPricingPath();
  const login = marketingLoginPath();
  const app = marketingDashboardPath();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">Rapid Cortex Desktop</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Desktop apps for your agency</h1>
      <p className="mt-5 text-pretty text-lg leading-relaxed text-slate-300">
        Rapid Cortex Desktop is available for <strong className="font-medium text-slate-200">Mac</strong> and{" "}
        <strong className="font-medium text-slate-200">Windows</strong>. It is built for{" "}
        <strong className="font-medium text-slate-200">dispatch workstations</strong> and{" "}
        <strong className="font-medium text-slate-200">agency-controlled deployment</strong> — not consumer
        self-serve downloads from the open web.
      </p>
      <ul className="mt-8 list-inside list-disc space-y-2 text-slate-300">
        <li>The desktop app requires an <strong className="font-medium text-slate-200">authorized Rapid Cortex account</strong>.</li>
        <li>
          Installers (<span className="font-mono text-slate-400">.dmg</span>,{" "}
          <span className="font-mono text-slate-400">.exe</span>,{" "}
          <span className="font-mono text-slate-400">.msi</span>) are{" "}
          <strong className="font-medium text-slate-200">not publicly downloadable</strong> from this page or from
          static URLs. They are stored in private cloud storage and issued only through authenticated admin flows
          with short-lived signed links.
        </li>
        <li>
          After install, users must <strong className="font-medium text-slate-200">sign in</strong> before accessing
          any Rapid Cortex incident data.
        </li>
      </ul>
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
