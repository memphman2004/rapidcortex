import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";

export const metadata = {
  title: "Developers — RC Lite API",
  description:
    "Documentation, sandbox behavior, webhook catalog, authentication, and API plans for Rapid Cortex RC Lite — secure intelligence APIs for CAD and dispatch platforms.",
};

const LINKS = [
  { href: "/developers/docs", label: "Documentation hub" },
  { href: "/developers/playground", label: "Interactive API playground" },
  { href: "/developers/docs/errors", label: "Error catalogue" },
  { href: "/developers/docs/authentication", label: "Authentication & API keys" },
  { href: "/developers/sandbox", label: "Sandbox vs production" },
  { href: "/developers/simulation", label: "Simulation payloads" },
  { href: "/developers/webhooks-test", label: "Webhook signature lab" },
  { href: "/developers/pricing", label: "API plans & ROI modeling" },
  { href: "/developers/roi", label: "Dispatcher + QA uplift calculator" },
  { href: "/developers/status", label: "Developer status" },
  { href: "/developers/changelog", label: "Changelog" },
  { href: "/trust", label: "Trust disclosures" },
  { href: "/integrations", label: "Partner integrations" },
  { href: "/rc-lite", label: "RC Lite product overview" },
] as const;

export default function DevelopersHubPage() {
  return (
    <MarketingArticleShell eyebrow="RC Lite" title="Developer portal" sectionLabel="Developers">
      <p className="text-lg leading-relaxed text-slate-200">
        RC Lite exposes Rapid Cortex intelligence over versioned HTTPS APIs for CAD vendors, dispatch stacks, emergency
        platforms, and partner software — separate from Rapid Cortex dashboards.
      </p>
      <p className="mt-4 leading-relaxed text-slate-400">
        Provision hashed API keys, attach scopes per integration, stream webhooks back to your control plane, and meter
        billable workload per tenant. Operational enforcement happens server-side; this portal documents contracts and safe
        usage patterns only.
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
