"use client";

import { Suspense } from "react";
import { CadIntegrationsPage } from "@/components/admin/cad/CadIntegrationsPage";
import { isApiConfigured } from "@/lib/api";
import { isCadAdminUiEnabled } from "@/lib/runtime-flags";

function CadIntegrationsPageFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-slate-400">
      <p className="text-sm">Loading CAD admin…</p>
    </div>
  );
}

export default function AdminCadPage() {
  const enabled = isCadAdminUiEnabled();
  const api = isApiConfigured();

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">CAD Integrations</h1>
        <p className="mt-3 text-sm text-slate-400">
          This admin surface is disabled. Set{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-300">NEXT_PUBLIC_ENABLE_CAD_ADMIN=1</code> for
          environments that expose the CAD integration API.
        </p>
      </div>
    );
  }

  if (!api) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">CAD Integrations</h1>
        <p className="mt-3 text-sm text-slate-400">
          Configure <code className="text-slate-300">NEXT_PUBLIC_API_BASE</code> or auth proxy mode so the browser can reach
          the Rapid Cortex API.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<CadIntegrationsPageFallback />}>
      <CadIntegrationsPage />
    </Suspense>
  );
}
