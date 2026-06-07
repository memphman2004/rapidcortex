"use client";

import { LocationsQrAdminPanel } from "@/components/locations/locations-qr-admin-panel";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import {
  userCanManageQrLocations,
  userCanViewQrLocations,
} from "@/lib/locations/qr-access";
import { isLocationsQrAdminEnabled } from "@/lib/runtime-flags";
import type { QRLocationVertical } from "rapid-cortex-shared";

export function QrLocationsWorkspace({
  vertical,
  orgCode,
  title = "QR Codes",
  description = "Register scan points, generate RCLI identifiers, and download print-ready QR assets.",
}: {
  vertical: QRLocationVertical;
  orgCode: string;
  title?: string;
  description?: string;
}) {
  const { user } = useSession();
  const enabled = isLocationsQrAdminEnabled();
  const api = isApiConfigured();
  const canView = userCanViewQrLocations(user);
  const canManage = userCanManageQrLocations(user);

  if (!enabled) {
    return (
      <p className="text-sm text-slate-400">
        QR locations are disabled. Set{" "}
        <code className="rounded bg-slate-900 px-1 text-slate-300">NEXT_PUBLIC_ENABLE_LOCATIONS_QR_ADMIN=1</code>.
      </p>
    );
  }

  if (!api) {
    return <p className="text-sm text-slate-400">Configure the API base URL to manage QR locations.</p>;
  }

  if (!canView) {
    return (
      <p className="text-sm text-slate-400">
        Your role does not have access to QR location management for this organization.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p>
      </div>
      <LocationsQrAdminPanel
        defaultVertical={vertical}
        defaultOrgCode={orgCode.toUpperCase()}
        canManage={canManage}
      />
    </div>
  );
}
