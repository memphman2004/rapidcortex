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
import { VenueAuditTimeline } from "./rfp/venue-audit-timeline";
import { VenueCaseWorkflowPanel } from "./rfp/venue-case-workflow-panel";
import { VenueEvidencePanel } from "./rfp/venue-evidence-panel";
import { VenueReportDistributePanel } from "./rfp/venue-report-distribute-panel";

type RfpTab = "cameras" | "evidence" | "case" | "audit" | "reports";

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
  const [tab, setTab] = useState<RfpTab>("cameras");
  const canMutate = canVenueSupervisorOps(userRole);
  const rfpEnabled = process.env.NEXT_PUBLIC_ENABLE_VENUE_RFP_CASE !== "0";

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
    return <p style={{ padding: 14, fontSize: 12, color: "var(--rc-text-muted)" }}>Loading incident…</p>;
  }

  if (error || !panel) {
    return (
      <div style={{ padding: 14 }}>
        <p style={{ fontSize: 12, color: "var(--rc-amber)" }}>{error ?? "Incident not found"}</p>
        <Link href={linkBase} style={{ fontSize: 12, color: "var(--rc-text-secondary)" }}>
          ← Operations center
        </Link>
      </div>
    );
  }

  const tabs: { id: RfpTab; label: string }[] = [
    { id: "cameras", label: "Cameras" },
    ...(rfpEnabled
      ? ([
          { id: "evidence", label: "Evidence" },
          { id: "case", label: "Case" },
          { id: "audit", label: "Audit" },
          { id: "reports", label: "Reports" },
        ] as { id: RfpTab; label: string }[])
      : []),
  ];

  return (
    <div>
      <div style={{ padding: "14px 14px 0" }}>
        <Link href={linkBase} style={{ color: "var(--rc-text-secondary)", fontSize: 12, textDecoration: "none" }}>
          ← Operations center
        </Link>
      </div>
      {rfpEnabled ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 14px 0",
            flexWrap: "wrap",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 999,
                border: tab === t.id ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
                background: tab === t.id ? "rgba(245,158,11,0.15)" : "transparent",
                color: tab === t.id ? "#f59e0b" : "var(--rc-text-muted)",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      {tab === "cameras" || !rfpEnabled ? (
        <IncidentCameraPanel
          agencyId={agencyId}
          incident={panel}
          canDispatch={canMutate}
          embedded
          mode="detail"
          onClose={() => router.push(linkBase)}
        />
      ) : null}
      {rfpEnabled && tab === "evidence" ? (
        <VenueEvidencePanel venueCode={venueCode} incidentId={incidentId} canMutate={canMutate} />
      ) : null}
      {rfpEnabled && tab === "case" ? (
        <VenueCaseWorkflowPanel venueCode={venueCode} incidentId={incidentId} canMutate={canMutate} />
      ) : null}
      {rfpEnabled && tab === "audit" ? (
        <VenueAuditTimeline venueCode={venueCode} incidentId={incidentId} />
      ) : null}
      {rfpEnabled && tab === "reports" ? (
        <VenueReportDistributePanel
          venueCode={venueCode}
          incidentId={incidentId}
          canMutate={canMutate}
        />
      ) : null}
    </div>
  );
}
