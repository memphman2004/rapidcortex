import Link from "next/link";
import { PublicWebConfigurationPanel } from "@/components/admin/public-web-configuration-panel";
import { PilotIntegrationStatusPanel } from "@/components/admin/pilot-integration-status";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AdminConfigurationPage({ params }: Props) {
  const { jurisdiction } = await params;
  const prefix = `/${jurisdiction}`;

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Configuration</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Read-only visibility for agency admins: browser feature flags and live integration posture.
          Platform auth and compute settings are not changed from this page — contact Rapid Cortex
          support for infrastructure changes.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Web app (public env + client flags)
        </h2>
        <div className="mt-4">
          <PublicWebConfigurationPanel />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 md:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          API / integration posture (authenticated)
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          Same payload as{" "}
          <Link href={`${prefix}/admin/integrations`} className="text-sky-400 hover:text-sky-300 hover:underline">
            Admin → Integrations
          </Link>
          . Multilingual provider labels and issue counts reflect server configuration.
        </p>
        <div className="mt-4">
          <PilotIntegrationStatusPanel />
        </div>
      </section>
    </div>
  );
}
