"use client";

import Link from "next/link";
import { PilotReadinessBanner } from "@/components/admin/pilot-readiness-banner";
import { RoleDashboardSmokePanel } from "@/components/dispatch/role-dashboard-smoke-panel";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isQaScoringEnabled } from "@/lib/runtime-flags";
import { AdminQaTemplatesWidget } from "@/components/dispatch/qa/admin-qa-templates-widget";

const cards = [
  {
    title: "IT setup & integration",
    description:
      "CAD integration guide, auth operations docs, API connectivity status, and shortcuts to integrations and security settings.",
    path: "/admin/pilot",
  },
  {
    title: "Configuration",
    description:
      "Read-only web flags, client-side pilot toggles, and live API integration posture (multilingual + AI chain summary).",
    path: "/admin/configuration",
  },
  {
    title: "Users",
    description: "List Cognito users, invite accounts, assign role and agency, deactivate access.",
    path: "/admin/users",
  },
  {
    title: "Audit log",
    description: "Recent operational events for your agency (incidents, transcripts, analyses).",
    path: "/admin/audit",
  },
  {
    title: "Protocol packs",
    description: "Built-in protocol catalog IDs; agency overrides will live in configuration.",
    path: "/admin/protocols",
  },
  {
    title: "QA protocol templates",
    description:
      "Checklist templates for automated QA scoring (Bedrock). Dispatchers attach a template when opening a QA session.",
    path: "/admin/qa/templates",
    featureFlag: "qa" as const,
  },
  {
    title: "Integrations",
    description: "Live integration status from the API (multilingual validation, AI tiers, connector rollout).",
    path: "/admin/integrations",
  },
  {
    title: "Environment",
    description: "Read-only operator map of deploy-time variables and compliance references (no secrets).",
    path: "/admin/settings",
  },
] as const;

export default function AdminOverviewPage() {
  const to = useJurisdictionLink();
  const visibleCards = cards.filter((c) => {
    if ("featureFlag" in c && c.featureFlag === "qa") return isQaScoringEnabled();
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-[var(--rc-content-max)] flex-col gap-4 px-4 py-4 lg:gap-5 lg:px-6 lg:py-5 2xl:px-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-white lg:text-xl">Administration</h1>
        <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-400">
          Operational controls for pilot tenants. Requires Cognito{" "}
          <code className="rounded bg-slate-900 px-1 text-slate-200">admin</code> role.
        </p>
      </div>
      <PilotReadinessBanner />
      <RoleDashboardSmokePanel
        title="Agency admin"
        pathLabel="/[jurisdiction]/admin"
      />
      {isQaScoringEnabled() ? <AdminQaTemplatesWidget /> : null}
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 2xl:gap-4">
        {visibleCards.map((c) => (
          <Link
            key={c.path}
            href={to(c.path)}
            className="flex min-h-0 flex-col rounded-lg border border-slate-800/90 bg-slate-900/50 p-3.5 transition-colors hover:border-slate-700 hover:bg-slate-900/80 lg:p-4"
          >
            <h2 className="text-sm font-semibold text-white">{c.title}</h2>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{c.description}</p>
            <span className="mt-3 text-xs font-medium text-sky-400">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
