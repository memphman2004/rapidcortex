"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { venueIncidentsToMap } from "@/components/maps/map-incident-adapters";
import { loadMapTheme, saveMapTheme } from "@/lib/maps/persisted-map-prefs";
import { C } from "@/lib/theme/rc-theme-tokens";
import { useVenueOpsData } from "@/components/venue/use-venue-ops-data";
import { OperationalAwarenessWorkspace } from "@/components/venue/operational-awareness/OperationalAwarenessWorkspace";
import type { OperationalPopoutKind } from "@/lib/venue/operational-awareness/pop-out";

export function OperationalMapPopoutClient({
  kind,
  venueCode,
  venueName,
  agencyId,
  userId,
  initialIncidentId,
}: {
  kind: OperationalPopoutKind;
  venueCode: string;
  venueName: string;
  agencyId: string;
  userId: string;
  initialIncidentId?: string | null;
}) {
  const { stats, onDuty, incidents, refreshAll } = useVenueOpsData(agencyId);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(initialIncidentId ?? null);
  const [mapTheme, setMapTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (!userId) return;
    setMapTheme(loadMapTheme(userId, "venue", "dark"));
  }, [userId]);

  const onMapThemeChange = useCallback(
    (next: "dark" | "light") => {
      setMapTheme(next);
      saveMapTheme(userId || null, "venue", next);
    },
    [userId],
  );

  const openIncidents = useMemo(
    () =>
      incidents.filter(
        (item) => item.status === "open" || item.status === "assigned" || item.status === "responding",
      ),
    [incidents],
  );
  const mapIncidents = useMemo(() => venueIncidentsToMap(openIncidents), [openIncidents]);

  const medicalResources = 4;
  const camerasOnline = Math.max(12, mapIncidents.length + 8);

  return (
    <div className="flex h-screen flex-col" style={{ background: C.bg }}>
      <header
        className="flex items-center justify-between gap-3 px-4 py-2"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-300">
            Rapid Cortex Venue
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {kind === "area" ? "Area Map" : "Facility Map"} · {venueName}
          </div>
        </div>
        <Link
          href={`/venue/${encodeURIComponent(venueCode)}`}
          className="text-[11px] font-semibold text-orange-200 hover:underline"
        >
          Back to dashboard
        </Link>
      </header>
      <div className="min-h-0 flex-1 p-2">
        <OperationalAwarenessWorkspace
          venueCode={venueCode}
          venueName={venueName}
          persistUserId={userId || null}
          mapTheme={mapTheme}
          onMapThemeChange={onMapThemeChange}
          liveIncidents={mapIncidents}
          selectedIncidentId={selectedIncidentId}
          onIncidentSelect={setSelectedIncidentId}
          activeIncidents={stats?.activeIncidents ?? openIncidents.length}
          staffOnDuty={stats?.securityOnDuty ?? onDuty.length}
          camerasOnline={camerasOnline}
          medicalResources={medicalResources}
          facilityAlerts={openIncidents.length}
          onRefresh={() => void refreshAll()}
          lockedViewMode={kind === "area" ? "area" : "facility"}
          compact
        />
      </div>
    </div>
  );
}
