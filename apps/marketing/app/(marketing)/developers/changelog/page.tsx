import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";

export const metadata = { title: "RC Lite — API Changelog" };

export default function DevelopersChangelogPage() {
  return (
    <MarketingArticleShell eyebrow="Changelog" title="API changelog" sectionLabel="Developers">
      <dl className="space-y-4 text-sm text-slate-300">
        <div>
          <dt className="font-semibold text-white">2026-04-28 · v1.1 productization</dt>
          <dd className="mt-2 text-slate-400">
            Ships signed webhook metadata, structured errors with documentation pointers and retry cues,
            deterministic idempotent POST flows, hashed dev canaries, RPM metadata per SKU, an interactive API playground behind
            the same CSP, ROI modeling helpers, integrations and trust packaging, downloadable OpenAPI and Postman assets, a
            sandbox simulation catalog, webhook lab tooling, supervised manual review scaffolding, tightened sandbox CAD export
            rules, analytics add-on metadata hooks, vendor cohort bundles, latency tier cues — surfaced through the playground,{" "}
            <Link className="text-sky-400 hover:text-sky-300" href="/trust">
              trust
            </Link>
            , and{" "}
            <Link className="text-sky-400 hover:text-sky-300" href="/integrations">
              integrations
            </Link>{" "}
            areas of this portal, plus{" "}
            <Link href="/openapi/rc-lite-v1.openapi.yaml" className="text-sky-400 hover:text-sky-300">
              RC Lite OpenAPI
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-white">2026-04-28 · v1 scaffold</dt>
          <dd className="mt-2 text-slate-400">
            Introduces the RC Lite routing surface, metering hooks, hashed API key flows, onboarding-oriented developer hub
            content, commercial SKU tiers presented to partners, and separation between API-first SKUs and full dispatcher /
            supervisor consoles.
          </dd>
        </div>
      </dl>
      <Link href="/developers" className="mt-10 inline-flex text-sm text-sky-400 hover:text-sky-300">
        ← Developers hub
      </Link>
    </MarketingArticleShell>
  );
}
