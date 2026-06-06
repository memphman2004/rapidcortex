"use client";

import Link from "next/link";
import { DocumentationArticleLink } from "@/components/admin/documentation-article-link";
import { PilotReadinessBanner } from "@/components/admin/pilot-readiness-banner";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

const quickLinks = [
  { path: "/admin/cad", label: "CAD integration" },
  { path: "/admin/integrations", label: "API keys & integrations" },
  { path: "/admin/security", label: "Security settings" },
  { path: "/admin/audit", label: "Audit log export" },
  { path: "/admin/readiness", label: "Integration status" },
] as const;

/** Agency IT setup — customer-facing technical resources only (no RC internal GTM/sales). */
export default function AdminPilotHubPage() {
  const to = useJurisdictionLink();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-white">IT setup & integration</h1>
        <p className="mt-1 text-sm text-slate-400">
          Technical resources for configuring Rapid Cortex at your agency.
        </p>
      </div>

      <PilotReadinessBanner showInfoLevel />

      <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
          Documents for agency IT
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Firewall, identity, and CAD vendor technical workstreams.
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>
            <DocumentationArticleLink
              file="admin-user-management/RapidCortex-CAD-Integration-Guide-1.0.pdf"
              label="Rapid Cortex CAD Integration Guide 1.0 (PDF)"
            />
          </li>
          <li>
            <DocumentationArticleLink
              file="admin-user-management/AUTH_OPERATIONS.md"
              label="Auth operations (Cognito, callbacks, CORS)"
            />
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
          Quick access
        </h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(({ path, label }) => (
            <Link
              key={path}
              href={to(path)}
              className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-sky-300 hover:border-slate-600 hover:bg-slate-900"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
