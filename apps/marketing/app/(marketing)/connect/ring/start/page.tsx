import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Connect your Ring account | Rapid Cortex",
  description:
    "Ring homeowners: link your Ring account to participate in voluntary emergency video sharing with local 911 agencies through Rapid Cortex Connect.",
  alternates: { canonical: absoluteUrl("/connect/ring/start") },
};

export default function RingCustomerStartPage() {
  return (
    <MarketingArticleShell
      eyebrow="Rapid Cortex Connect"
      title="Ring homeowners"
      sectionLabel="Connect"
    >
      <p className="leading-relaxed text-slate-200">
        This program is for <strong className="text-white">Ring account holders</strong>, not
        dispatch center staff. You do not need a Rapid Cortex username or password to participate.
      </p>

      <section className="mt-8 space-y-4 rounded-2xl border border-sky-500/25 bg-sky-950/30 p-6 text-sm leading-relaxed text-slate-300">
        <h2 className="text-base font-semibold text-white">How it works</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You link your Ring account once with a participating agency you choose. That agency
            can request video only when you have opted in and a qualifying incident involves your
            enrolled devices.
          </li>
          <li>
            <strong className="text-slate-100">Every video request is approved separately.</strong>{" "}
            Dispatchers never receive standing access to your cameras.
          </li>
          <li>
            You can disconnect your Ring account at any time from your connection settings.
          </li>
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-slate-300">
        <h2 className="text-base font-semibold text-white">Connect your Ring account</h2>
        <p className="mt-3 leading-relaxed">
          Homeowner self-service linking is not open on this page yet. If your agency invited you to
          enroll, use the link they provided — it includes your agency&apos;s enrollment details.
          Otherwise contact us and we will notify you when enrollment opens in your area.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="mailto:support@rapidcortex.us?subject=Ring%20Connect%20homeowner%20enrollment"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Contact support
          </a>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
          >
            Privacy policy
          </Link>
        </div>
      </section>

      <p className="mt-10 text-xs text-slate-500">
        Dispatch center staff should use{" "}
        <Link href="https://app.rapidcortex.us/login" className="text-sky-400 hover:text-sky-300">
          agency sign-in
        </Link>
        , not this page.
      </p>
    </MarketingArticleShell>
  );
}
