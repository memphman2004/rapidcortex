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
          CAD admin isn’t enabled for this agency. Contact Rapid Cortex support.
        </p>
      </div>
    );
  }

  if (!api) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">CAD Integrations</h1>
        <p className="mt-3 text-sm text-slate-400">
          Platform connection isn’t configured. Contact Rapid Cortex support.
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
