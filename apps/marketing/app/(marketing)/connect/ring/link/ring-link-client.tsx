"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { demoJurisdictionSlug } from "@/lib/deployment-environment";
import { marketingLoginPath, marketingSignupPath } from "@/lib/marketing-links";

type LinkAudience = "citizen" | "agency";

type StatusMessage = {
  tone: "ok" | "err" | "neutral";
  title: string;
  body: string;
};

function parseAudience(raw: string | null): LinkAudience {
  return raw?.trim().toLowerCase() === "citizen" ? "citizen" : "agency";
}

function statusMessage(
  status: string | null,
  audience: LinkAudience,
  deviceCount: number | null,
): StatusMessage {
  if (audience === "citizen") {
    if (status === "success" || status === "connected") {
      const devicesLine =
        typeof deviceCount === "number"
          ? deviceCount === 1
            ? " We registered 1 Ring device on your account."
            : ` We registered ${deviceCount} Ring devices on your account.`
          : "";
      return {
        tone: "ok",
        title: "Ring account connected",
        body: `Your Ring account is linked with Rapid Cortex Connect.${devicesLine} Dispatchers at participating agencies can request video only for qualifying incidents near your address — and only when you approve sharing for that request.`,
      };
    }
    if (status === "error") {
      return {
        tone: "err",
        title: "Ring connection could not be completed",
        body: "We could not finish linking your Ring account. Try connecting again from the Ring Connect page, or contact support if the problem continues.",
      };
    }
    return {
      tone: "neutral",
      title: "Rapid Cortex Connect · Ring",
      body: "Complete Ring enrollment from the Connect page — you can sign up even if your local agency has not enrolled yet.",
    };
  }

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

function CitizenLinkActions({ status }: { status: string | null }) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href="/connect/ring/start"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
      >
        Ring Connect home
      </Link>
      <a
        href="mailto:support@rapidcortex.us?subject=Ring%20Connect%20device%20owner%20help"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
      >
        Contact support
      </a>
      <Link
        href="/privacy"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
      >
        Privacy policy
      </Link>
      {status === "error" ? (
        <p className="w-full text-xs text-slate-500">
          Return to Ring Connect and try again — you can enroll with or without a local agency
          selected.
        </p>
      ) : null}
    </div>
  );
}

function AgencyLinkActions() {
  const jurisdiction = demoJurisdictionSlug();
  const loginHref = marketingLoginPath();
  const signupHref = marketingSignupPath();
  const mediaHref = `https://app.rapidcortex.us/${jurisdiction}/media`;

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
        >
          Sign in to Rapid Cortex
        </Link>
        <Link
          href={signupHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sky-500/60 px-5 text-sm font-semibold text-sky-300 hover:border-sky-400 hover:text-sky-200"
        >
          Sign up
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
            href={signupHref}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Sign up for Rapid Cortex
          </Link>
          <Link
            href="https://www.rapidcortex.us/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-5 text-sm font-semibold text-slate-100 hover:border-slate-500"
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
    </>
  );
}

export function RingLinkClient() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const audience = parseAudience(searchParams.get("audience"));
  const devicesRaw = searchParams.get("devices");
  const deviceCount =
    devicesRaw != null && devicesRaw !== "" && Number.isFinite(Number(devicesRaw))
      ? Number(devicesRaw)
      : null;
  const msg = statusMessage(status, audience, deviceCount);

  return (
    <article className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
        {audience === "citizen" ? "Ring Device Owners" : "Rapid Cortex Connect"}
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{msg.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">{msg.body}</p>

      {audience === "citizen" ? (
        <CitizenLinkActions status={status} />
      ) : (
        <AgencyLinkActions />
      )}

      <div className="mt-10 space-y-2 border-t border-slate-800 pt-6 text-xs text-slate-500">
        {audience === "citizen" ? (
          <p>
            Dispatch center staff should use{" "}
            <Link href={marketingLoginPath()} className="text-sky-400 hover:text-sky-300">
              agency sign-in
            </Link>
            , not this page.
          </p>
        ) : null}
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
