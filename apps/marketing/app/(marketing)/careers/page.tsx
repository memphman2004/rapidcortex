import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Careers | NexCort iQ",
  description: "Join the team building the next generation of public safety intelligence.",
  path: "/careers",
});

/**
 * Careers holding page — applications not yet open.
 * To restore the full job board, swap this export for <CareersJobsClient />.
 */
export default function CareersPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Careers</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        We&rsquo;re building the team
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-400">
        NexCort iQ is growing. Open positions will be posted here when we&rsquo;re ready to hire.
        In the meantime, you&rsquo;re welcome to reach out and introduce yourself.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href="mailto:careers@nexcortiq.us"
          className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
        >
          Say hello
        </a>
        <a
          href="https://www.linkedin.com/company/rapidcortex"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-slate-700 px-6 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Follow on LinkedIn
        </a>
      </div>

      <p className="mt-10 text-xs text-slate-600">
        Apps on Demand LLC d/b/a NexCort iQ ·{" "}
        <Link href="/privacy" className="hover:text-slate-400">
          Privacy policy
        </Link>
      </p>
    </div>
  );
}
