"use client";

import { LocationsQrAdminPanel } from "@/components/locations/locations-qr-admin-panel";
import { isApiConfigured } from "@/lib/api";
import { isLocationsQrAdminEnabled } from "@/lib/runtime-flags";

export default function AdminLocationsPage() {
  const enabled = isLocationsQrAdminEnabled();
  const api = isApiConfigured();

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Locations &amp; QR Codes</h1>
        <p className="mt-3 text-sm text-slate-400">
          Enable{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-300">
            NEXT_PUBLIC_ENABLE_LOCATIONS_QR_ADMIN=1
          </code>{" "}
          in environments that expose the QR locations API.
        </p>
      </div>
    );
  }

  if (!api) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Locations &amp; QR Codes</h1>
        <p className="mt-3 text-sm text-slate-400">
          Configure <code className="text-slate-300">NEXT_PUBLIC_API_BASE</code> or auth proxy mode.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[var(--rc-content-max)] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
      <div>
        <h1 className="text-lg font-semibold text-white lg:text-xl">Locations &amp; QR Codes</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Register scan points, generate RCLI identifiers, and download print-ready QR assets for campus and
          venue deployments.
        </p>
      </div>
      <LocationsQrAdminPanel />
    </div>
  );
}
