import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";
import { RingConnectFlow } from "./ring-connect-flow";

export const metadata: Metadata = {
  title: "Ring Device Owners | Rapid Cortex Connect",
  description:
    "Ring Device Owners: enable Rapid Cortex Connect in the Ring Appstore for voluntary, consent-gated emergency video sharing with local 911 agencies. Every request requires your approval.",
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
        This program is for <strong className="text-white">Ring Device Owners</strong> (Ring account
        holders with doorbells or cameras) — not dispatch center staff. Agency login is not used for
        enrollment.
      </p>

      <section className="mt-8 space-y-4 rounded-2xl border border-sky-500/25 bg-sky-950/30 p-6 text-sm leading-relaxed text-slate-300">
        <h2 className="text-base font-semibold text-white">How it works</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-slate-100">Enable in the Ring Appstore.</strong> Open Ring →
            Appstore → search <strong className="text-slate-100">Rapid Cortex Connect</strong>{" "}
            → Get App, or use the{" "}
            <a
              href="https://ring.com/pages/appstore/rapid-cortex-connect"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 underline hover:text-sky-300"
            >
              Rapid Cortex Connect listing
            </a>
            . Select which devices to share, then finish Rapid Cortex sign-in if Ring shows{" "}
            <em>Pending — App sign-in required</em>.
          </li>
          <li>
            <strong className="text-slate-100">Every request needs your approval.</strong> When a
            nearby emergency involves your address, dispatchers can request temporary camera access.
            You receive an SMS with Allow and Decline — you decide every time. You can also Stop
            Sharing while a session is active.
          </li>
          <li>
            <strong className="text-slate-100">Nothing is automatic.</strong> No video is shared until
            you tap Allow. Access is time-limited, and you can stop sharing anytime.
          </li>
          <li>
            <strong className="text-slate-100">Disconnect anytime</strong> from Ring → My Apps, or by
            removing Rapid Cortex Connect.
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
        , not this page. Agency Ring linking uses a separate dispatcher OAuth flow in the Media
        workspace.
      </p>
    </MarketingArticleShell>
  );
}
