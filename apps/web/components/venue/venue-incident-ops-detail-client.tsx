"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { fetchVenueIncident } from "@/lib/venue/venue-incident-api";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import { canVenueSupervisorOps } from "@/lib/vertical/supervisor-access";
import { incidentTypeLabel } from "@/app/venue/[venueCode]/_components/IncidentTypeIcon";
import { IncidentCameraPanel, type VenueActiveIncidentPanel } from "./IncidentCameraPanel";

export function VenueIncidentOpsDetailClient({
  agencyId,
  venueCode,
  incidentId,
  linkBase,
  userRole,
}: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  linkBase: string;
  userRole?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<VenueActiveIncidentPanel | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const incident = await fetchVenueIncident(venueCode, incidentId);
        if (!incident) {
          if (!cancelled) setError("Incident not found");
          return;
        }
        let cameras: VenueIncidentCameraSummary[] = [];
        try {
          cameras = await fetchVenueSectionCameras(agencyId, incident.zoneCode, 2);
        } catch {
          cameras = [];
        }
        if (cancelled) return;
        setPanel({
          incidentId: incident.id,
          section: incident.zoneCode,
          reportType: incidentTypeLabel(incident.type),
          location: incident.zoneLabel || incident.qrLocationName || incident.description.slice(0, 60),
          cameras,
          createdAt: incident.createdAt,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load incident");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, incidentId, venueCode]);

  if (loading) {
    return <p style={{ padding: 14, fontSize: 12, color: "#5a4d7a" }}>Loading incident…</p>;
  }

  if (error || !panel) {
    return (
      <div style={{ padding: 14 }}>
        <p style={{ fontSize: 12, color: "#f59e0b" }}>{error ?? "Incident not found"}</p>
        <Link href={linkBase} style={{ fontSize: 12, color: "#7c6fa0" }}>
          ← Operations center
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "14px 14px 0" }}>
        <Link href={linkBase} style={{ color: "#7c6fa0", fontSize: 12, textDecoration: "none" }}>
          ← Operations center
        </Link>
      </div>
      <IncidentCameraPanel
        agencyId={agencyId}
        incident={panel}
        canDispatch={canVenueSupervisorOps(userRole)}
        embedded
        mode="detail"
        onClose={() => router.push(linkBase)}
      />
    </div>
  );
}
