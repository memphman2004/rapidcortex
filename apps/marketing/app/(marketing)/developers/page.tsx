import Link from "next/link";
import type { Metadata } from "next";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { marketingDevelopersDocsPath } from "@/lib/marketing-links";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";

const PRESS_EMAIL = "info@rapidcortex.us";
const FOUNDED_YEAR = 2025;

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Developers — RC Lite API | Rapid Cortex",
  description: `RC Lite APIs from ${SITE_NAME}, a product of ${SITE_OPERATOR_NAME} (founded ${FOUNDED_YEAR}). Documentation, sandbox, webhooks, authentication, and API plans for CAD and dispatch platforms.`,
  path: "/developers",
});

const LINKS = [
  { href: marketingDevelopersDocsPath(), label: "Documentation hub" },
  { href: "/developers/playground", label: "Interactive API playground" },
  { href: marketingDevelopersDocsPath("errors"), label: "Error catalogue" },
  { href: marketingDevelopersDocsPath("authentication"), label: "Authentication & API keys" },
  { href: "/developers/sandbox", label: "Sandbox vs production" },
  { href: "/developers/simulation", label: "Simulation payloads" },
  { href: "/developers/webhooks-test", label: "Webhook signature lab" },
  { href: "/developers/pricing", label: "API plans & ROI modeling" },
  { href: "/developers/roi", label: "Dispatcher + QA uplift calculator" },
  { href: "/developers/status", label: "Developer status" },
  { href: "/developers/changelog", label: "Changelog" },
  { href: "/status", label: "Platform status" },
  { href: "/trust", label: "Trust disclosures" },
  { href: "/integrations", label: "Partner integrations" },
  { href: "/rc-lite", label: "RC Lite product overview" },
] as const;

export default function DevelopersHubPage() {
  return (
    <MarketingArticleShell eyebrow="RC Lite · API" title="Developer portal" sectionLabel="Developers">
      <p className="text-lg leading-relaxed text-slate-200">
        RC Lite exposes {SITE_NAME} intelligence over versioned HTTPS APIs for CAD vendors, dispatch
        stacks, emergency platforms, and partner software — separate from the full {SITE_NAME}{" "}
        dashboards used in the web and desktop apps.
      </p>
      <p className="mt-4 leading-relaxed text-slate-400">
        {SITE_NAME} is a product of{" "}
        <a
          href={SITE_OPERATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300"
        >
          {SITE_OPERATOR_NAME}
        </a>
        , founded in {FOUNDED_YEAR}. Provision hashed API keys, attach scopes per integration, stream
        webhooks back to your control plane, and meter billable workload per tenant. Operational
        enforcement happens server-side; this portal documents contracts and safe usage patterns.
      </p>

      <dl className="mt-8 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</dt>
          <dd className="mt-1 text-slate-200">
            {SITE_NAME} · RC Lite API
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator</dt>
          <dd className="mt-1 text-slate-200">{SITE_OPERATOR_NAME}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Founded</dt>
          <dd className="mt-1 text-slate-200">{FOUNDED_YEAR}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Press / partner contact</dt>
          <dd className="mt-1">
            <a href={`mailto:${PRESS_EMAIL}`} className="text-sky-400 hover:text-sky-300">
              {PRESS_EMAIL}
            </a>
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-sm leading-relaxed text-slate-400">
        Need the full operational console instead? Agency teams use the same role dashboards on the{" "}
        <Link href="/desktop" className="text-sky-400 hover:text-sky-300">
          desktop apps
        </Link>{" "}
        and in the browser — RC Lite is the API-only path for partners embedding intelligence in their
        own products.
      </p>

      <ul className="mt-10 space-y-3 text-sm text-sky-400/95">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link className="hover:text-sky-300 hover:underline" href={l.href}>
              {l.label} →
            </Link>
          </li>
        ))}
      </ul>
    </MarketingArticleShell>
  );
}
