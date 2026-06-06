import Link from "next/link";

import { marketingContactPath } from "@/lib/marketing-links";

export const metadata = {
  title: "API documentation",
  description:
    "Rapid Cortex RC Lite programmatic API overview — OAuth client-credentials and HTTPS APIs for approved integration partners.",
};

export default function ApiDocumentationLandingPage() {
  const contact = marketingContactPath();
  const contactApi = `${contact}?subject=${encodeURIComponent("API access request")}`;
  const publishedApiBase = process.env.NEXT_PUBLIC_RC_LITE_API_URL?.trim();

  return (
    <div className="min-h-full px-4 py-14 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">
          Rapid Cortex · RC Lite programmatic API
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          API documentation
        </h1>

        <div className="mt-8 rounded-lg border border-sky-800/70 bg-sky-950/50 p-5 text-sm text-sky-100">
          <p className="font-medium text-white">OpenAPI reference</p>
          <p className="mt-2 text-pretty leading-relaxed text-sky-100/90">
            Machine-readable API contracts are published for approved partners. View the{" "}
            <Link href="/openapi/rc-lite-v1.openapi.yaml" className="font-medium text-white underline hover:text-sky-100">
              RC Lite OpenAPI document
            </Link>{" "}
            on this site.
          </p>
        </div>

        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-white">Authentication & base URL</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Approved clients use OAuth2 client credentials: obtain a token from the token endpoint, then call versioned HTTPS
            routes under your assigned base (paths include <span className="font-mono text-slate-200">…/oauth/token</span> and{" "}
            <span className="font-mono text-slate-200">…/api/v1/…</span>). Your onboarding package lists the exact host and
            credentials for sandbox and production.
          </p>
          {publishedApiBase ? (
            <p className="mt-3 text-xs text-slate-500">
              Example base for this deployment:{" "}
              <span className="font-mono text-slate-300">{publishedApiBase.replace(/\/$/, "")}</span>
            </p>
          ) : null}

          <h3 className="mt-8 text-base font-semibold text-white">Example request shape</h3>
          <pre className="mt-3 overflow-x-auto rounded-md border border-slate-800 bg-slate-950 p-4 text-xs text-emerald-200/95">
            {`curl -sS -X POST 'https://{your-assigned-host}/api/v1/oauth/token' \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -d 'grant_type=client_credentials&client_id=…&client_secret=…'`}
          </pre>

          <h3 className="mt-8 text-base font-semibold text-white">Scope</h3>
          <p className="mt-2 text-sm text-slate-400">
            Contracts cover intelligence workloads, CAD export patterns, transcription, translation, QA, caller media,
            partner webhooks, and related capabilities — gated by entitlements negotiated per tenant.
          </p>
        </div>

        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-white">Need access?</h2>
          <p className="mt-2 text-sm text-slate-400">
            Sandbox keys, scopes, and production promotion are coordinated with Rapid Cortex onboarding. Ask for connectivity
            details and conformance review through the channels below.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/developers/docs"
              className="inline-flex rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Developer guides
            </Link>
            <Link
              href={contactApi}
              className="inline-flex rounded-md border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              Request API access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
