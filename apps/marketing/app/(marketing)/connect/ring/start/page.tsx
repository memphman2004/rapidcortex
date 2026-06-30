import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";
import { RingConnectFlow } from "./ring-connect-flow";

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
            <strong className="text-slate-100">Enable in the Ring app.</strong> Open Ring → Skills
            → search for Rapid Cortex → Enable. Select your local agency on the next screen.
          </li>
          <li>
            <strong className="text-slate-100">Every video request is approved separately.</strong>{" "}
            When a nearby incident involves your address, dispatchers can request temporary access.
            You decide — every time.
          </li>
          <li>
            <strong className="text-slate-100">Disconnect anytime.</strong> Manage or remove your
            connection from your Ring account settings at any time.
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
