"use client";

import Link from "next/link";
import { AgencyOnboardingMilestonesTracker } from "@/components/admin/agency-onboarding-milestones-tracker";
import { DocumentationArticleLink } from "@/components/admin/documentation-article-link";
import { PilotOnboardingTracker } from "@/components/admin/pilot-onboarding-tracker";
import { isDemoScriptedContentEnabled } from "@/lib/deployment-environment";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { getDocumentationBaseUrl } from "@/lib/documentation-links";

const quickLinks = [
  { path: "/admin/configuration", label: "Configuration" },
  { path: "/admin/users", label: "Users & roles" },
  { path: "/admin/integrations", label: "Integration status" },
  { path: "/admin/audit", label: "Audit log" },
  { path: "/admin/settings", label: "Environment reference" },
  { path: "/admin/billing", label: "Billing" },
  { path: "/admin/protocols", label: "Protocol packs" },
] as const;

/** Rapid Cortex internal GTM, sales, and onboarding operations — RC Admin only. */
export function RcInternalOperationsHub() {
  const to = useJurisdictionLink();
  const docsBaseConfigured = Boolean(getDocumentationBaseUrl());

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Internal operations</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          GTM, promise control, onboarding trackers, and sales-ready definitions for Rapid Cortex
          platform operators. Not shown to agency IT or customer admins.
        </p>
        {!docsBaseConfigured ? (
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-amber-200/90">
            Set <span className="font-mono text-slate-300">NEXT_PUBLIC_DOCUMENTATION_BASE_URL</span> for
            hosted doc links.
          </p>
        ) : null}
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          GTM & implementation package
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
          <li>
            <DocumentationArticleLink file="GTM_PACKAGE.md" label="Go-to-market & onboarding package (start here)" />
          </li>
          <li>
            <DocumentationArticleLink
              file="JURISDICTION_OPERATIONS_GUIDE.md"
              label="Jurisdiction operations guide (customer program docs — IT & admins)"
            />
          </li>
          <li className="text-xs leading-relaxed text-slate-400">
            Customer program documentation ZIP:{" "}
            <span className="font-mono text-slate-300">npm run package:customer-docs</span>
          </li>
          <li>
            <DocumentationArticleLink file="SALES_SCOPE_MATRIX.md" label="Sales & solutions — promise vs out of scope" />
          </li>
          <li>
            <DocumentationArticleLink file="PILOT_READINESS.md" label="Pilot readiness hub (checklist index)" />
          </li>
          <li>
            <DocumentationArticleLink file="USER_GUIDE.md" label="User guide (operators)" />
          </li>
          <li>
            <DocumentationArticleLink file="ADMIN_GUIDE.md" label="Admin guide" />
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Sales-ready product definitions
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <li><DocumentationArticleLink file="PRODUCT_OVERVIEW.md" label="Product overview" /></li>
          <li><DocumentationArticleLink file="PILOT_OVERVIEW.md" label="Pilot overview" /></li>
          <li><DocumentationArticleLink file="IDEAL_CUSTOMER_PROFILE.md" label="Ideal customer profile" /></li>
          <li><DocumentationArticleLink file="USE_CASES.md" label="Primary use cases" /></li>
          <li><DocumentationArticleLink file="FEATURE_MATRIX.md" label="Feature maturity matrix" /></li>
          <li><DocumentationArticleLink file="PILOT_VS_FUTURE_STATE.md" label="Pilot vs future state" /></li>
          <li><DocumentationArticleLink file="KNOWN_LIMITATIONS.md" label="Known limitations" /></li>
          <li><DocumentationArticleLink file="IMPLEMENTATION_ASSUMPTIONS.md" label="Implementation assumptions" /></li>
          <li><DocumentationArticleLink file="PILOT_SUCCESS_AND_FEEDBACK.md" label="Pilot success & feedback (index)" /></li>
          <li><DocumentationArticleLink file="PILOT_SUCCESS_METRICS.md" label="Pilot success metrics (measurable)" /></li>
          <li><DocumentationArticleLink file="FEEDBACK_LOOP.md" label="Feedback loop (cadence & outputs)" /></li>
          <li><DocumentationArticleLink file="PILOT_REVIEW_TEMPLATE.md" label="Pilot review meeting template" /></li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Promise control (internal)
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
          <li><DocumentationArticleLink file="PROMISE_CONTROL.md" label="Promise control — claims checklist" /></li>
          <li><DocumentationArticleLink file="SALES_BOUNDARIES.md" label="Sales boundaries — roles & safe phrasing" /></li>
          <li><DocumentationArticleLink file="PILOT_NON_GOALS.md" label="Pilot non-goals — never-promise list" /></li>
          <li><DocumentationArticleLink file="FAQ_INTERNAL.md" label="FAQ — internal (sales & support)" /></li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Agency onboarding workflow
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
          <li><DocumentationArticleLink file="AGENCY_ONBOARDING_RUNBOOK.md" label="Agency onboarding runbook" /></li>
          <li><DocumentationArticleLink file="AGENCY_SETUP_CHECKLIST.md" label="Agency setup checklist" /></li>
          <li><DocumentationArticleLink file="PILOT_KICKOFF_CHECKLIST.md" label="Pilot kickoff checklist" /></li>
          <li>
            <DocumentationArticleLink file="IMPLEMENTATION_WORKBOOK_TEMPLATE.md" label="Implementation workbook template" />
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">Admin shortcuts</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((l) => (
            <Link
              key={l.path}
              href={to(l.path)}
              className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-sky-300 hover:border-slate-600 hover:bg-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">Sales / demo consistency</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {isDemoScriptedContentEnabled() ? (
            <>
              Scripted scenarios live under{" "}
              <Link href={to("/demo")} className="font-mono text-sky-400 hover:text-sky-300 hover:underline">
                /demo
              </Link>
              .{" "}
            </>
          ) : (
            <>Scripted academy routes under <span className="font-mono text-slate-500">/…/demo</span> are disabled. </>
          )}
          Production dispatch uses{" "}
          <Link href={to("/dashboard")} className="font-mono text-sky-400 hover:text-sky-300 hover:underline">
            /dashboard
          </Link>
          .
        </p>
      </section>

      <AgencyOnboardingMilestonesTracker to={to} />
      <PilotOnboardingTracker to={to} />
    </div>
  );
}
