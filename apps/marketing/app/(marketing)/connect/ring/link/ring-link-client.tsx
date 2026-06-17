"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { demoJurisdictionSlug } from "@/lib/deployment-environment";
import { marketingLoginPath } from "@/lib/marketing-links";

function statusMessage(status: string | null): { tone: "ok" | "err" | "neutral"; title: string; body: string } {
  if (status === "success" || status === "connected") {
    return {
      tone: "ok",
      title: "Ring account linked",
      body: "Your Ring devices are connected to Rapid Cortex Connect. Sign in to manage cameras from the dispatcher Media workspace.",
    };
  }
  if (status === "error") {
    return {
      tone: "err",
      title: "Ring connection failed",
      body: "We could not complete the Ring authorization. Sign in and try Connect Ring Account again from Media.",
    };
  }
  return {
    tone: "neutral",
    title: "Rapid Cortex Connect · Ring",
    body: "Link your Ring account from the Rapid Cortex app, then return here after authorization completes.",
  };
}

export function RingLinkClient() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const msg = statusMessage(status);
  const jurisdiction = demoJurisdictionSlug();
  const loginHref = marketingLoginPath();
  const mediaHref = `https://app.rapidcortex.us/${jurisdiction}/media`;

  return (
    <article className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">Rapid Cortex Connect</p>
      <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{msg.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">{msg.body}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
        >
          Sign in to Rapid Cortex
        </Link>
        <Link
          href={mediaHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
        >
          Open Media workspace
        </Link>
      </div>

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">New to Rapid Cortex?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Rapid Cortex is available to licensed emergency communications centers, campus safety departments,
          and venue security operations.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="https://www.rapidcortex.us/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Request Access
          </Link>
          <Link
            href="https://www.rapidcortex.us"
            className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-sky-400 hover:text-sky-300"
          >
            Learn more about Rapid Cortex
          </Link>
        </div>
      </section>

      <div className="mt-10 space-y-2 border-t border-slate-800 pt-6 text-xs text-slate-500">
        <p>
          Need help?{" "}
          <Link href="/contact" className="text-sky-400 hover:text-sky-300">
            Contact support
          </Link>{" "}
          or email{" "}
          <a href="mailto:support@rapidcortex.us" className="text-sky-400 hover:text-sky-300">
            support@rapidcortex.us
          </a>
          .
        </p>
        <p>
          <Link href="/terms" className="text-sky-400 hover:text-sky-300">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="text-sky-400 hover:text-sky-300">
            Privacy
          </Link>
        </p>
      </div>
    </article>
  );
}
