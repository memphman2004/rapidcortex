import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { SeoMetricsPanel } from "@/components/marketing/seo-metrics-panel";

export const metadata = {
  title: "Website & SEO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CheckStatus = "done" | "in-progress" | "pending" | "manual";

type SeoCheck = {
  area: string;
  item: string;
  status: CheckStatus;
  note?: string;
  href?: string;
};

const SEO_CHECKLIST: SeoCheck[] = [
  // Crawlability
  {
    area: "Crawlability",
    item: "robots.txt allows all public marketing pages",
    status: "done",
    note: "Updated with per-bot policies for Googlebot, OAI-SearchBot, ClaudeBot, PerplexityBot, GPTBot, Google-Extended, Bingbot, and social crawlers. Stale public/robots.txt (Disallow: / for all bots) deleted Nov 2026 — Next.js app/robots.ts is now the only source of truth.",
  },
  {
    area: "Crawlability",
    item: "AI crawlers explicitly permitted (ChatGPT, Claude, Gemini, Perplexity)",
    status: "done",
    note: "OAI-SearchBot, GPTBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended all allowed.",
  },
  {
    area: "Crawlability",
    item: "WAF / CloudFront does not challenge verified AI crawler IPs",
    status: "manual",
    note: "Manual step: Verify Perplexity's published IP ranges are not blocked by CloudFront WAF. Perplexity documents their crawler IPs for AWS WAF configuration. Repeat for OAI-SearchBot and ClaudeBot using their published ranges.",
    href: "https://docs.perplexity.ai/guides/seo-integration",
  },
  {
    area: "Crawlability",
    item: "XML sitemap valid and submitted",
    status: "done",
    note: "/sitemap.xml includes all public marketing routes including 6 new category pages added Nov 2026.",
  },

  // llms.txt
  {
    area: "AI Discovery",
    item: "/llms.txt machine-readable product overview",
    status: "done",
    note: "Created at /llms.txt with accurate product descriptions, capabilities, and key page links.",
  },
  {
    area: "AI Discovery",
    item: "AI visibility test library populated",
    status: "in-progress",
    note: "24 buyer questions pre-seeded in AI Visibility tab. Run tests and log results to establish baseline.",
    href: "/rc-admin/marketing/ai-visibility",
  },

  // Structured data
  {
    area: "Structured Data",
    item: "Organization JSON-LD on homepage",
    status: "done",
    note: "Schema.org Organization structured data present on homepage.",
  },
  {
    area: "Structured Data",
    item: "WebSite JSON-LD with SearchAction",
    status: "done",
    note: "WebSite structured data present on homepage.",
  },
  {
    area: "Structured Data",
    item: "SoftwareApplication JSON-LD on homepage",
    status: "done",
    note: "SoftwareApplication type with applicationCategory present.",
  },
  {
    area: "Structured Data",
    item: "FAQPage JSON-LD on category pages",
    status: "done",
    note: "KeywordLandingPage component generates FAQPage schema when faq[] is provided. All 6 new pages include FAQs.",
  },

  // Category pages
  {
    area: "Category Pages",
    item: "/nexiq — NEXiQ non-emergency call automation",
    status: "done",
    note: "Created Nov 2026 with full content, FAQs, and structured data.",
    href: "/nexiq",
  },
  {
    area: "Category Pages",
    item: "/iq-vision — iQ Vision AI scene intelligence",
    status: "done",
    note: "Created Nov 2026.",
    href: "/iq-vision",
  },
  {
    area: "Category Pages",
    item: "/transit-safety-software — Transit safety",
    status: "done",
    note: "Created Nov 2026.",
    href: "/transit-safety-software",
  },
  {
    area: "Category Pages",
    item: "/ai-311 — AI 311 and municipal call handling",
    status: "done",
    note: "Created Nov 2026.",
    href: "/ai-311",
  },
  {
    area: "Category Pages",
    item: "/campus-safety-without-app — No-app campus reporting",
    status: "done",
    note: "Created Nov 2026.",
    href: "/campus-safety-without-app",
  },
  {
    area: "Category Pages",
    item: "/cad-interoperability — CAD-to-CAD hub",
    status: "done",
    note: "Created Nov 2026.",
    href: "/cad-interoperability",
  },
  {
    area: "Category Pages",
    item: "/ai-public-safety-software — Primary head-term landing page",
    status: "done",
    note: "Created Nov 2026 targeting 'AI public safety software' and 'public safety software' head terms. Priority 0.95 in sitemap. Full content with 6 sections + FAQPage schema.",
    href: "/ai-public-safety-software",
  },
  {
    area: "Category Pages",
    item: "/public-safety-intelligence — Full landing page (was redirect)",
    status: "done",
    note: "Replaced redirect to /product/core with a full keyword landing page Nov 2026. Targets 'public safety intelligence platform' and 'public safety intelligence software'. Priority 0.9 in sitemap.",
    href: "/public-safety-intelligence",
  },

  // Homepage title + H1
  {
    area: "Homepage",
    item: "Homepage <title> targets primary head term",
    status: "done",
    note: "Title changed Nov 2026 to 'AI Public Safety Software for 911 & Emergency Operations | NexCort iQ'. Previously: 'NexCort iQ | Intelligence at the speed of response'.",
    href: "/",
  },
  {
    area: "Homepage",
    item: "Homepage H1 includes keyword",
    status: "done",
    note: "H1 changed Nov 2026 to 'AI Public Safety Software for 911, Emergency Communications & Security Operations'. Brand slogan kept as italic subtitle.",
    href: "/",
  },

  // Conversion tools
  {
    area: "Conversion Tools",
    item: "/nexiq/savings-calculator — NEXiQ workload calculator",
    status: "done",
    note: "Interactive calculator with lead capture and CSV-downloadable formula transparency.",
    href: "/nexiq/savings-calculator",
  },
  {
    area: "Conversion Tools",
    item: "/modernization-assessment — 911 readiness questionnaire",
    status: "done",
    note: "8-question assessment with capability matching and consultation request form.",
    href: "/modernization-assessment",
  },

  // External setup
  {
    area: "Analytics Setup",
    item: "GA4 property verified and tracking active",
    status: "done",
    note: "G-NGT17QK1LW active via GTM-M33PD9HM. Verify generate_lead, demo_request, pilot_application, calculator_completed, assessment_completed events fire via GTM preview. Key-event marking deferred pending approval.",
  },
  {
    area: "Analytics Setup",
    item: "Google Search Console verified and sitemap submitted",
    status: "manual",
    note: "Manual step: Confirm sitemap https://www.nexcortiq.us/sitemap.xml on sc-domain:nexcortiq.us, then grant SA nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com.",
    href: "https://search.google.com/search-console",
  },
  {
    area: "Analytics Setup",
    item: "Bing Webmaster Tools — sitemap submitted",
    status: "manual",
    note: "Manual step: Verify or add nexcortiq.us in Bing Webmaster Tools and submit sitemap. Bing reports some Copilot/chat-search impressions directly.",
    href: "https://www.bing.com/webmasters",
  },
  {
    area: "Analytics Setup",
    item: "GA4 Data API → Marketing Dashboard integration",
    status: "in-progress",
    note: "Live panel below reads GA4 via Secrets Manager SA (rapid-cortex/marketing/ga4-service-account). Grant Viewer on the existing property — do not create a duplicate stream.",
  },
  {
    area: "Analytics Setup",
    item: "Search Console API → Search & SEO tab",
    status: "in-progress",
    note: "Live panel below reads Search Console (90d impressions/clicks/position). Grant the same SA on sc-domain:nexcortiq.us. Indexing API is not used for ordinary pages.",
  },
];

const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string; dot: string }> = {
  done: {
    label: "Done",
    color: "text-emerald-300 bg-emerald-950/40 border-emerald-700/40",
    dot: "bg-emerald-400",
  },
  "in-progress": {
    label: "In progress",
    color: "text-sky-300 bg-sky-950/40 border-sky-700/40",
    dot: "bg-sky-400",
  },
  pending: {
    label: "Pending",
    color: "text-slate-500 bg-slate-800/40 border-slate-700/40",
    dot: "bg-slate-600",
  },
  manual: {
    label: "Manual step",
    color: "text-amber-400 bg-amber-950/40 border-amber-700/40",
    dot: "bg-amber-400",
  },
};

const AREAS = [...new Set(SEO_CHECKLIST.map((c) => c.area))];

export default async function WebsiteSeoPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/website`);
  }

  const done = SEO_CHECKLIST.filter((c) => c.status === "done").length;
  const manual = SEO_CHECKLIST.filter((c) => c.status === "manual").length;
  const pending = SEO_CHECKLIST.filter((c) => c.status === "pending").length;

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Website & SEO</h1>
          <p className="mt-1 text-sm text-slate-400">
            Technical SEO status, AI discoverability setup, and integration checklist.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="rounded-full bg-emerald-950/50 px-3 py-1 text-emerald-300">
            {done} done
          </span>
          {manual > 0 && (
            <span className="rounded-full bg-amber-950/50 px-3 py-1 text-amber-400">
              {manual} manual
            </span>
          )}
          {pending > 0 && (
            <span className="rounded-full bg-slate-800/50 px-3 py-1 text-slate-500">
              {pending} pending
            </span>
          )}
        </div>
      </div>

      {/* CRM-derived web attribution */}
      <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">CRM-Derived Web Attribution</h2>
        <p className="text-sm text-slate-400">
          Lead source channel breakdown (organic_search, linkedin, referral, direct, ai_referral,
          etc.) is derived from UTM parameters and referrer URL patterns on every inbound lead and
          is live today in{" "}
          <Link href="/rc-admin/marketing" className="text-sky-400 hover:underline">
            Marketing Overview
          </Link>
          .
        </p>
      </div>

      {/* Checklist by area */}
      <div className="space-y-6">
        {AREAS.map((area) => {
          const checks = SEO_CHECKLIST.filter((c) => c.area === area);
          return (
            <div key={area} className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">{area}</h2>
              <div className="space-y-3">
                {checks.map((check, i) => {
                  const cfg = STATUS_CONFIG[check.status];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-3"
                    >
                      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{check.item}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        {check.note && (
                          <p className="mt-1 text-xs text-slate-500">{check.note}</p>
                        )}
                        {check.href && (
                          check.href.startsWith("http") ? (
                            <a
                              href={check.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 text-xs text-sky-500 hover:text-sky-400 hover:underline"
                            >
                              {check.href} ↗
                            </a>
                          ) : (
                            <Link
                              href={check.href}
                              className="mt-1 block text-xs text-sky-500 hover:text-sky-400 hover:underline"
                            >
                              {check.href} →
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Live Search Console & GA4</h2>
          <p className="mt-1 text-sm text-slate-400">
            Impressions, rankings, landing traffic, AI referrals, and CRM lead conversion — read-only
            Google APIs plus shared CRM counts.
          </p>
        </div>
        <SeoMetricsPanel />
      </div>
    </div>
  );
}
