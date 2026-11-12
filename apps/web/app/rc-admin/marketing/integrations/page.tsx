import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Marketing Integrations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const INTEGRATIONS = [
  {
    name: "Apollo.io",
    description: "Prospect database, email sequences, and website visitor tracking.",
    status: "configured",
    configHref: "/rc-admin/sales-automation",
  },
  {
    name: "Amazon SES",
    description: "Email delivery for campaigns and newsletters with open / click tracking.",
    status: "configured",
    configHref: "/rc-admin/sales-automation",
  },
  {
    name: "NexCort iQ CRM",
    description: "Shared lead database. All marketing captures write here — no duplication.",
    status: "configured",
    configHref: "/rc-admin/leads/integrations",
  },
  {
    name: "HubSpot",
    description: "Two-way CRM sync for deals, contacts, and activities.",
    status: "setup-required",
    configHref: "/rc-admin/leads/integrations",
  },
  {
    name: "Google Analytics 4",
    description: "Website visitors, events, and conversion tracking via GA4 Data API.",
    status: "phase2",
    configHref: null,
  },
  {
    name: "Google Search Console",
    description: "Organic search clicks, impressions, and keyword rankings.",
    status: "phase2",
    configHref: null,
  },
  {
    name: "LinkedIn Marketing API",
    description: "Post performance, campaign metrics, and audience engagement.",
    status: "phase2",
    configHref: null,
  },
] as const;

const STATUS_CONFIG = {
  configured: { label: "Connected", color: "text-emerald-400 bg-emerald-950/50 border-emerald-500/30" },
  "setup-required": { label: "Setup required", color: "text-amber-400 bg-amber-950/50 border-amber-500/30" },
  phase2: { label: "Phase 2", color: "text-slate-500 bg-slate-800/50 border-slate-700/30" },
} as const;

export default async function MarketingIntegrationsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/integrations`);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Marketing Integrations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Connected data sources that power the Growth Command Center.
        </p>
      </div>
      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => {
          const cfg = STATUS_CONFIG[integration.status];
          return (
            <div
              key={integration.name}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#0a1628] px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{integration.name}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{integration.description}</p>
              </div>
              {integration.configHref ? (
                <Link
                  href={integration.configHref}
                  className="shrink-0 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08]"
                >
                  Configure →
                </Link>
              ) : (
                <span className="shrink-0 text-xs text-slate-600">Coming Phase 2</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
