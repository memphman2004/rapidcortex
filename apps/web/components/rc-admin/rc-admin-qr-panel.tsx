"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { resolveAgencyVerticalFromTenant } from "@/lib/vertical";
import { LocationsQrAdminPanel } from "@/components/locations/locations-qr-admin-panel";
import { useSession } from "@/components/auth/session-context";
import { fetchAgencies } from "@/lib/api";
import { userCanManageQrLocations, userCanViewQrLocations } from "@/lib/locations/qr-access";
import { isLocationsQrAdminEnabled } from "@/lib/runtime-flags";

function orgCodeFromAgency(agencyId: string, vertical: "campus" | "venue"): string {
  const token = agencyId.trim();
  const match = token.match(/(?:campus|venue)-([a-z0-9]+)/i);
  if (match?.[1]) return match[1].toUpperCase();
  return token.slice(-4).toUpperCase() || vertical.toUpperCase();
}

export function RcAdminQrPanel() {
  const { user } = useSession();
  const enabled = isLocationsQrAdminEnabled();
  const [selectedAgencyId, setSelectedAgencyId] = useState("");

  const agenciesQ = useQuery({
    queryKey: ["agencies", "qr-admin"],
    queryFn: fetchAgencies,
  });

  const venueCampusAgencies = useMemo(() => {
    return (agenciesQ.data ?? []).filter((agency) => {
      const vertical = resolveAgencyVerticalFromTenant(agency);
      return vertical === "venue" || vertical === "campus";
    });
  }, [agenciesQ.data]);

  const selected = venueCampusAgencies.find((a) => a.agencyId === selectedAgencyId);
  const vertical = selected
    ? resolveAgencyVerticalFromTenant(selected) === "venue"
      ? "venue"
      : "campus"
    : "campus";
  const orgCode = selected ? orgCodeFromAgency(selected.agencyId, vertical) : "";

  const canView = userCanViewQrLocations(user, selectedAgencyId || undefined);
  const canManage = userCanManageQrLocations(user, selectedAgencyId || undefined);

  if (!enabled) {
    return (
      <p className="text-sm text-slate-400">
        QR locations are disabled. Set{" "}
        <code className="rounded bg-slate-900 px-1 text-slate-300">NEXT_PUBLIC_ENABLE_LOCATIONS_QR_ADMIN=1</code>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Location QR Codes</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Create, edit, bulk-import, and download QR scan points for venue and campus tenants. Select a
          tenant to scope all API operations.
        </p>
      </div>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <label className="block text-sm font-medium text-slate-200" htmlFor="rc-qr-agency-picker">
          Tenant agency
        </label>
        <select
          id="rc-qr-agency-picker"
          value={selectedAgencyId}
          onChange={(e) => setSelectedAgencyId(e.target.value)}
          className="mt-2 w-full max-w-xl rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          disabled={agenciesQ.isLoading}
        >
          <option value="">Select an agency…</option>
          {venueCampusAgencies.map((agency) => (
            <option key={agency.agencyId} value={agency.agencyId}>
              {agency.name} ({agency.agencyId}) — {resolveAgencyVerticalFromTenant(agency)}
            </option>
          ))}
        </select>
        {agenciesQ.isError ? (
          <p className="mt-2 text-sm text-red-300">Failed to load agencies. Refresh to try again.</p>
        ) : null}
      </section>

      {!selectedAgencyId ? (
        <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-400">
          Select a venue or campus agency to manage QR scan points.
        </p>
      ) : !canView ? (
        <p className="text-sm text-slate-400">Your role cannot view QR locations for this tenant.</p>
      ) : (
        <LocationsQrAdminPanel
          scopedAgencyId={selectedAgencyId}
          defaultVertical={vertical}
          defaultOrgCode={orgCode}
          canManage={canManage}
        />
      )}
    </div>
  );
}
