"use client";

import { C2cHubAdminPage } from "@/components/c2c/c2c-hub-admin";
import { isApiConfigured } from "@/lib/api";
import { isC2cHubUiEnabled } from "@/lib/runtime-flags";

export default function AdminC2cHubPage() {
  if (!isC2cHubUiEnabled()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">C2C Hub</h1>
        <p className="mt-3 text-sm text-slate-400">The C2C hub isn’t enabled for this agency.</p>
      </div>
    );
  }
  if (!isApiConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">C2C Hub</h1>
        <p className="mt-3 text-sm text-slate-400">Platform connection isn’t configured.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <C2cHubAdminPage />
    </div>
  );
}
