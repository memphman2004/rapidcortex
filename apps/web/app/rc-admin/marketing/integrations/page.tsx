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
    description:
      "Website visitors, events, and conversion tracking via GA4 Data API. Property G-NGT17QK1LW active via GTM-M33PD9HM. Dashboard pull uses Secrets Manager SA rapid-cortex/marketing/ga4-service-account.",
    status: "setup-required",
    configHref: "/rc-admin/marketing/website",
    setupNote:
      "SA nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com is created and stored in AWS. Grant Viewer on the existing GA4 property for G-NGT17QK1LW — do not create a duplicate property or stream.",
  },
  {
    name: "Google Search Console",
    description:
      "Organic search clicks, impressions, keyword rankings, and indexed page coverage. Must be verified for nexcortiq.us (not rapidcortex.us).",
    status: "setup-required",
    configHref: "https://search.google.com/search-console",
    setupNote:
      "Add nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com to the nexcortiq.us Search Console property, confirm /sitemap.xml, then open Website & SEO for live metrics.",
  },
  {
    name: "Bing Webmaster Tools",
    description:
      "Bing search impressions, clicks, and some Copilot/chat-search referral data. Provides additional evidence of AI-sourced traffic beyond what GA4 captures.",
    status: "setup-required",
    configHref: "https://www.bing.com/webmasters",
    setupNote: "Verify nexcortiq.us in Bing Webmaster Tools, submit /sitemap.xml, then configure Bing Webmaster Tools API key in Secrets Manager at rapid-cortex/marketing/bing-webmaster-api-key.",
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

type Integration = {
  name: string;
  description: string;
  status: keyof typeof STATUS_CONFIG;
  configHref: string | null;
  setupNote?: string;
};

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
        {(INTEGRATIONS as readonly Integration[]).map((integration) => {
          const cfg = STATUS_CONFIG[integration.status];
          const isExternal = integration.configHref?.startsWith("http");
          return (
            <div
              key={integration.name}
              className="rounded-xl border border-white/[0.06] bg-[#0a1628] px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{integration.name}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{integration.description}</p>
                  {integration.setupNote && (
                    <p className="mt-1.5 rounded bg-amber-950/20 px-2 py-1 text-xs text-amber-200/70">
                      Setup: {integration.setupNote}
                    </p>
                  )}
                </div>
                {integration.configHref ? (
                  isExternal ? (
                    <a
                      href={integration.configHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08]"
                    >
                      Open ↗
                    </a>
                  ) : (
                    <Link
                      href={integration.configHref}
                      className="shrink-0 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08]"
                    >
                      Configure →
                    </Link>
                  )
                ) : (
                  <span className="shrink-0 text-xs text-slate-600">Coming Phase 2</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
