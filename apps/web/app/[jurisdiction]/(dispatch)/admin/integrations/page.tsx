import Link from "next/link";
import { WebhookEventIngressPlaceholder } from "rapid-cortex-integrations";
import { IntegrationSecurityPolicy } from "rapid-cortex-security";
import { PilotIntegrationStatusPanel } from "@/components/admin/pilot-integration-status";
import { RingConnectButton, RingIntegrationStatus, isRingEnabled } from "@/src/features/connect/ring";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AdminIntegrationsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const to = (path: string) =>
    `/${jurisdiction}${path.startsWith("/") ? path : `/${path}`}`;

  const policy = new IntegrationSecurityPolicy().defaultPolicy();
  const webhook = new WebhookEventIngressPlaceholder();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Pilot view: live API integration status (authenticated) plus outbound policy. External CAD
          and telephony follow adapter workstreams — see{" "}
          <span className="font-mono text-slate-300">docs/NON_GOALS.md</span>,{" "}
          <span className="font-mono text-slate-300">docs/INTEGRATIONS_CAD_AND_MOTOROLA.md</span>, and the agency IT
          PDF <span className="font-mono text-slate-300">docs/admin-user-management/RapidCortex-CAD-Integration-Guide-1.0.pdf</span>{" "}
          (also under <span className="font-mono text-slate-300">Admin → Pilot</span> → Documents for agency IT).
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Live integration status
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          From <span className="font-mono text-slate-400">GET /api/integration/status</span> — use
          for pilot readiness (see <span className="font-mono">docs/PILOT_READINESS.md</span>).
        </p>
        <div className="mt-4">
          <PilotIntegrationStatusPanel />
        </div>
      </section>

      {isRingEnabled() && (
        <section className="rounded-lg border border-zinc-800 bg-slate-900/35 p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Ring Doorbell Integration
          </h3>
          <RingIntegrationStatus agencyId="" userId="" />
          <RingConnectButton agencyId="" userId="" />
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Outbound policy (default)
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Allowed host suffixes: {policy.allowedHostSuffixes.join(", ")}
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Webhook ingress (roadmap)
        </h2>
        <p className="mt-2 font-mono text-xs text-slate-400">{webhook.adapterId}</p>
        <p className="mt-2 text-xs text-slate-500">
          Production ingress validates signatures, tenant routing, and replay protection before
          emitting normalized domain events.
        </p>
      </section>

      <p className="text-sm text-slate-400">
        <Link href={to("/admin/settings")} className="text-sky-400 hover:underline">
          Environment & compliance →
        </Link>
      </p>
    </div>
  );
}
