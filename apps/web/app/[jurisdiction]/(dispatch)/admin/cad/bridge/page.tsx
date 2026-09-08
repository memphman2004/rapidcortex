"use client";

import { CadBridgeAdminPage } from "@/components/cad-bridge/cad-bridge-admin";
import { isApiConfigured } from "@/lib/api";
import { isCadBridgeUiEnabled } from "@/lib/runtime-flags";

export default function AdminCadBridgePage() {
  if (!isCadBridgeUiEnabled()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">CAD Bridge</h1>
        <p className="mt-3 text-sm text-slate-400">CAD Bridge isn’t enabled for this agency.</p>
      </div>
    );
  }
  if (!isApiConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">CAD Bridge</h1>
        <p className="mt-3 text-sm text-slate-400">Platform connection isn’t configured.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <CadBridgeAdminPage />
    </div>
  );
}
