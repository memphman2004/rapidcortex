import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";
import { RingConnectFlow } from "./ring-connect-flow";

export const metadata: Metadata = {
  title: "Connect your Ring account | Rapid Cortex",
  description:
    "Ring Device Owners: link your Ring account to participate in voluntary emergency video sharing with local 911 agencies through Rapid Cortex Connect.",
  alternates: { canonical: absoluteUrl("/connect/ring/start") },
};

export default function RingCustomerStartPage() {
  return (
    <MarketingArticleShell
      eyebrow="Rapid Cortex Connect"
      title="Ring Device Owners"
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
            <strong className="text-slate-100">Connect once.</strong> Link your Ring account now —
            even if your local 911 center hasn&apos;t enrolled yet. You&apos;ll be ready when they
            do.
          </li>
          <li>
            <strong className="text-slate-100">Every request needs your approval.</strong> When a
            nearby emergency involves your address, dispatchers can request temporary camera access.
            You decide — every time.
          </li>
          <li>
            <strong className="text-slate-100">Nothing is automatic.</strong> You receive a
            notification for each request and must tap Approve before any video is shared.
          </li>
          <li>
            <strong className="text-slate-100">Disconnect anytime</strong> from your Ring app
            settings.
          </li>
        </ul>
      </section>

      <Suspense fallback={null}>
        <RingConnectFlow />
      </Suspense>

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
