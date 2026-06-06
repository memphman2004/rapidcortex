import type { Metadata } from "next";
import Link from "next/link";
import { SiteLogoMark } from "@/components/brand/site-logo-link";
import {
  marketingBookDemoPath,
  marketingHomePath,
} from "@/lib/marketing-links";

export const metadata: Metadata = {
  title: "Desktop access required · Rapid Cortex",
  robots: { index: false, follow: false },
};

export default function MobileAccessRestrictedPage() {
  const home = marketingHomePath();
  const demo = marketingBookDemoPath();

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
        <div className="mb-10 flex justify-center">
          <SiteLogoMark heightClass="h-28" priority />
        </div>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
          Desktop Access Required
        </h1>
        <p className="mt-4 text-center text-sm leading-relaxed text-slate-400">
          Rapid Cortex console access is restricted to approved desktop workstations. For security,
          dispatcher, supervisor, and admin access is not available from mobile devices.
        </p>
        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          If you believe you need mobile access for an approved operational use case, contact your agency
          administrator.
        </p>
        <p className="mt-10 text-center text-xs text-slate-500 lg:hidden">
          Rapid Cortex console access is available from approved desktop workstations only.
        </p>
        <div className="mx-auto mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={home}
            className="rounded-md bg-sky-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-sky-500"
          >
            Return to Rapid Cortex
          </Link>
          <Link
            href={demo}
            className="rounded-md border border-slate-700 px-5 py-2.5 text-center text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-white"
          >
            Book a Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
