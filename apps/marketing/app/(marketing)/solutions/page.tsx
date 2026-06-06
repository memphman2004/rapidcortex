import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";

export const metadata = {
  title: "Solutions | Rapid Cortex",
  description:
    "Operational intelligence solutions for agencies and OEM/integration partners across dispatch, supervisor, QA, reporting, and integration workflows.",
};

export default function SolutionsPage() {
  return (
    <MarketingArticleShell eyebrow="Solutions" title="Operational intelligence solutions" sectionLabel="Solutions">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Agencies</h2>
        <p>
          Rapid Cortex brings modern dispatch workstations, supervisory overview, QA and learning loops, responder
          awareness, and executive dashboards into one agency-scoped tenancy with audit-ready instrumentation.
        </p>
        <ul>
          <li>Dispatcher workspace with transcript, triage, and multilingual support.</li>
          <li>Supervisor command tooling for escalations and workload visibility.</li>
          <li>QA/training readiness with reproducible review trails.</li>
          <li>Executive and IT/security reporting for tenant operations.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-white">Vendors and OEM partners</h2>
        <p>
          CAD vendors, RMS partners, GIS integrators, and municipal IT collaborators can certify against Rapid Cortex
          APIs, webhook delivery, telemetry, and onboarding paths while preserving tenant-scoped guardrails.
        </p>
        <ul>
          <li>Scoped API clients with rotation and rate awareness.</li>
          <li>Webhook signing for tamper-evident payloads.</li>
          <li>Usage metering and audit logs per tenant boundary.</li>
          <li>Developer documentation aligned with operational security narratives.</li>
        </ul>
      </section>
    </MarketingArticleShell>
  );
}

