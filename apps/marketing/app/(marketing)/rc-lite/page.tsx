import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import {
  marketingContactSalesPath,
  marketingDevelopersApiPath,
  marketingPricingPath,
} from "@/lib/marketing-links";

export const metadata = {
  title: "RC Lite — API-only Rapid Cortex intelligence",
  description:
    "RC Lite gives approved agencies and public safety technology partners secure API access to Rapid Cortex intelligence without requiring the full Rapid Cortex dashboard platform.",
};

export default function RcLiteMarketingPage() {
  const pricing = marketingPricingPath();
  const contactSales = marketingContactSalesPath();
  const docs = marketingDevelopersApiPath();

  return (
    <MarketingArticleShell
      eyebrow="API product — not the full Rapid Cortex dashboards"
      title="RC Lite: Rapid Cortex intelligence through API access"
      sectionLabel="RC Lite"
    >
      <p className="text-lg font-medium leading-relaxed text-slate-100">
        Secure public-safety intelligence APIs for CAD vendors, dispatch platforms, emergency operations systems, and
        safety-focused software teams. RC Lite lets approved partners add Rapid Cortex intelligence to their own systems —
        including incident classification, risk scoring, CAD-ready export, transcription, translation, caller media links,
        and QA analysis.
      </p>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Disclaimer: RC Lite enhances existing emergency systems. It does not replace CAD, RMS, 911 telephony, or official
        dispatch procedures.
      </p>
      <p className="mt-10 text-xl font-semibold tracking-tight text-sky-300">
        Emergency intelligence, delivered by API.
      </p>

      <h2 className="mt-12 text-xl font-semibold text-white" id="what">
        What RC Lite is
      </h2>
      <p className="mt-4 leading-relaxed text-slate-300">
        RC Lite is an <strong className="font-semibold text-slate-100">API-only integration product</strong>—not a
        dispatcher, supervisor, QA, or administrator web application. It ships OAuth client credentials, tenant-scoped REST
        endpoints, webhooks, and usage-aware billing for teams embedding Rapid Cortex intelligence in CAD, RMS, GIS, or
        custom municipal systems.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-white" id="who">
        Who RC Lite is for
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">
        <li>CAD, RMS, and GIS vendors integrating approved APIs</li>
        <li>Municipal IT teams and statewide public safety programs</li>
        <li>Agencies that require API access only (no operational Rapid Cortex web dashboards)</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-white" id="includes">
        What the API includes
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">
        <li>API access, API portal surfaces, and OAuth-style client credential management</li>
        <li>Sandbox and production API environment controls</li>
        <li>
          Productized APIs: incident, transcript, AI summary, translation, caller media links, reporting, audit logs
        </li>
        <li>
          CAD export through the API contract only (<strong className="text-slate-100">not</strong> the in-app CAD
          operational workflow from Rapid Cortex Command)
        </li>
        <li>Webhooks, usage tracking, API-side billing signals, and developer documentation</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-white" id="use-cases">
        Example use cases
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">
        <li>Surfacing AI incident summaries and multilingual translation inside a vendor CAD console</li>
        <li>Federating caller media links and CAD-ready payloads into RMS records</li>
        <li>Driving statewide interoperability layers without standing up another PSAP dashboard product</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-white" id="security">
        Security and audit logging
      </h2>
      <p className="mt-4 leading-relaxed text-slate-300">
        Tenant-scoped credentials roll up to agency boundaries, signed webhooks, CJIS-aware engineering patterns, and
        audit-friendly access logs. Operational enforcement happens server-side—not by hiding UI controls alone.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-white" id="billing">
        Usage-based billing
      </h2>
      <p className="mt-4 leading-relaxed text-slate-300">
        RC Lite is invoiced as its own SKU with usage meters for API calls, AI summaries, transcription, translation, and
        related artifacts. Scope is confirmed during procurement; public marketing pages intentionally omit list pricing.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-white" id="environments">
        Sandbox and production access
      </h2>
      <p className="mt-4 leading-relaxed text-slate-300">
        Separate sandbox and production credentials help vendors certify integrations before cutover. Operational promotion
        gates stay under Rapid Cortex security review.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-white" id="webhooks">
        Webhooks
      </h2>
      <p className="mt-4 leading-relaxed text-slate-300">
        Event-driven webhooks cover export readiness, transcript completion, and webhook health—ideal for asynchronous CAD
        pipelines and vendor-side automation.
      </p>

      <div className="mt-12 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white" id="portal">
          Signed-in console
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          RC Lite customers use the dedicated API console to rotate credentials, inspect usage, configure webhooks, and open
          documentation—still <strong className="font-semibold text-slate-100">not</strong> the Rapid Cortex dispatcher or
          supervisor applications.
        </p>
        <Link
          href="/rc-lite/portal"
          className="mt-4 inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900"
        >
          RC Lite portal overview →
        </Link>
      </div>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link
          href={`${contactSales}?interest=api_access`}
          className="inline-flex rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-950/30 hover:bg-sky-500"
        >
          Request RC Lite Access
        </Link>
        <Link
          href={`${contactSales}?interest=integration`}
          className="inline-flex rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          Talk to Integration Team
        </Link>
        <Link
          href={pricing}
          className="inline-flex rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          Compare Rapid Cortex platform plans
        </Link>
        <Link href={docs} className="inline-flex rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900">
          Developer docs
        </Link>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-slate-500">
        Rapid Cortex remains the full web dashboard platform. RC Lite never rebrands those consoles—“RC Lite dashboards” are
        not part of this SKU. Agencies that adopt both purchase Rapid Cortex platform licensing plus either RC Lite as a
        standalone API entitlement or the API Access Add-On layered onto Command / Enterprise deployments.
      </p>
    </MarketingArticleShell>
  );
}
