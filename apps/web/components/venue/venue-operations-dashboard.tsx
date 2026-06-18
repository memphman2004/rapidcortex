/**
 * Venue Operations Center — separate from 911 dispatcher and campus safety.
 * No CAD, triage, transcription, or PSAP intake.
 */

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Plus,
  Shield,
  Users,
  Volume2,
} from "lucide-react";
import { canVenueSupervisorOps } from "@/lib/vertical/supervisor-access";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import {
  IncidentCameraPanel,
  type VenueActiveIncidentPanel,
} from "./IncidentCameraPanel";
import { VenueOperationsShell } from "./venue-operations-shell";
import {
  CreateVenueIncidentModal,
  NotifyStaffModal,
  VenueBroadcastModal,
} from "./venue-ops-modals";
import { VenueThreatStrip, useVenueThreatLevel } from "./venue-threat-strip";
import {
  formatVenueTimeAgo,
  mapVenueIncidentStatus,
  mapVenueIncidentType,
  useVenueOpsData,
} from "./use-venue-ops-data";

const V = {
  surface: "#100e1a",
  surfaceAlt: "#141220",
  border: "#1e1a30",
  amber: "#f59e0b",
  amberDim: "#1a1206",
  green: "#10b981",
  greenDim: "#0a1810",
  red: "#ef4444",
  textPrimary: "#e4dff5",
  textSecondary: "#5a4d7a",
  textMuted: "#2d2445",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: typeof AlertCircle;
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: V.surface,
        border: `1px solid ${V.border}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <Icon size={14} color={V.amber} />
        <span style={{ color: V.amber, fontSize: 20, fontWeight: 800 }}>{value}</span>
      </div>
      <div style={{ color: "#7c6fa0", fontSize: 11, fontWeight: 600 }}>{label}</div>
      {subtitle ? <div style={{ color: V.textMuted, fontSize: 10, marginTop: 2 }}>{subtitle}</div> : null}
    </div>
  );
}

function sectionStatusDot(incidentCount: number): { color: string; label: string } {
  if (incidentCount >= 2) return { color: V.red, label: "MULTIPLE" };
  if (incidentCount >= 1) return { color: V.amber, label: "ACTIVE" };
  return { color: V.green, label: "CLEAR" };
}

export function VenueOperationsDashboard({
  agencyId,
  venueName = "Venue",
  agencySlug,
  linkBase,
  userEmail = "",
  userRole,
}: {
  agencyId: string;
  venueName?: string;
  agencySlug?: string;
  linkBase: string;
  userEmail?: string;
  userRole?: string;
}) {
  const venueCode = agencySlug ?? agencyId;
  const canSupervisor = canVenueSupervisorOps(userRole);
  const { level: threatLevel, setLevel: setThreatLevel } = useVenueThreatLevel(agencyId);
  const { loading, error, stats, sections, onDuty, incidents, refreshAll } = useVenueOpsData(agencyId);

  const [createOpen, setCreateOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<VenueActiveIncidentPanel | null>(null);

  const handleIncidentCreated = useCallback(
    async (data: Record<string, unknown>) => {
      const incidentId = String(data.incidentId ?? "");
      const section = String(data.section ?? "");
      if (!incidentId || !section) return;

      let cameras = (data.cameras as VenueIncidentCameraSummary[] | undefined) ?? [];
      if (cameras.length === 0) {
        try {
          cameras = await fetchVenueSectionCameras(agencyId, section, 2);
        } catch {
          cameras = [];
        }
      }

      setActiveIncident({
        incidentId,
        section,
        reportType: String(data.reportType ?? "incident"),
        location: String(data.location ?? `Section ${section}`),
        cameras,
        createdAt: String(data.createdAt ?? new Date().toISOString()),
      });
    },
    [agencyId],
  );

  useAgencyWebSocket((msg) => {
    if (msg.type === "incident:created") {
      void handleIncidentCreated(msg.data);
    }
    if (msg.type === "camera:offline" && activeIncident) {
      const cameraId = String(msg.data.cameraId ?? "");
      const sections = (msg.data.sections as string[] | undefined) ?? [];
      if (!cameraId || !sections.includes(activeIncident.section)) return;
      void (async () => {
        const replacements = await fetchVenueSectionCameras(agencyId, activeIncident.section, 10);
        setActiveIncident((prev) => {
          if (!prev) return prev;
          const nextCameras = prev.cameras.map((cam) => {
            if (cam.cameraId !== cameraId) return cam;
            const replacement = replacements.find(
              (r) => r.cameraId !== cameraId && !prev.cameras.some((c) => c.cameraId === r.cameraId),
            );
            return replacement ?? cam;
          });
          return { ...prev, cameras: nextCameras.filter(Boolean) };
        });
      })();
    }
  });

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={userEmail}
      userRole={userRole}
      threatLevel={threatLevel}
    >
      <VenueThreatStrip
        level={threatLevel}
        canChange={canSupervisor}
        onChange={setThreatLevel}
      />

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {error ? (
          <div style={{ color: V.amber, fontSize: 12, padding: 8, background: V.amberDim, borderRadius: 6 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <MetricCard
            icon={AlertCircle}
            label="Active Incidents"
            value={loading ? "—" : (stats?.activeIncidents ?? incidents.length)}
            subtitle="Open security incidents"
          />
          <MetricCard
            icon={Users}
            label="Security On Duty"
            value={loading ? "—" : (stats?.securityOnDuty ?? onDuty.length)}
            subtitle={`${onDuty.filter((s) => s.status === "available").length} available`}
          />
          <MetricCard
            icon={Building2}
            label="Sections Monitored"
            value={loading ? "—" : (stats?.sectionsMonitored ?? sections.length)}
            subtitle="Venue sections"
          />
          <MetricCard
            icon={Shield}
            label="Guest Reports Today"
            value={loading ? "—" : (stats?.guestReportsToday ?? 0)}
            subtitle="QR + SMS intake"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Active incidents */}
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8 }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${V.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertTriangle size={13} color="#7c6fa0" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6fa0", letterSpacing: "0.05em" }}>
                  ACTIVE INCIDENTS
                </span>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {incidents.length === 0 ? (
                  <p style={{ color: V.textMuted, fontSize: 11, margin: 0 }}>No open incidents.</p>
                ) : (
                  incidents.map((inc) => (
                    <Link
                      key={inc.id}
                      href={`${linkBase}/incidents/${encodeURIComponent(inc.id)}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div
                        style={{
                          background: V.surfaceAlt,
                          border: `1px solid ${V.border}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            background: `${V.amber}22`,
                            border: `1px solid ${V.amber}44`,
                            borderRadius: 4,
                            padding: "2px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                            color: V.amber,
                            minWidth: 72,
                            textAlign: "center",
                          }}
                        >
                          {mapVenueIncidentType(inc.type)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: V.textPrimary }}>
                            Section {inc.zoneCode} · {inc.zoneLabel}
                          </div>
                          <div style={{ fontSize: 10, color: V.textSecondary }}>
                            {inc.qrLocationName ?? inc.description.slice(0, 40)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: V.amber,
                              background: V.amberDim,
                              padding: "2px 6px",
                              borderRadius: 999,
                            }}
                          >
                            {mapVenueIncidentStatus(inc.status)}
                          </span>
                          <div style={{ fontSize: 10, color: V.textMuted, marginTop: 2 }}>
                            {formatVenueTimeAgo(inc.updatedAt || inc.createdAt)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
                <Link href={`${linkBase}/reports`} style={{ color: V.textMuted, fontSize: 11, textAlign: "center", textDecoration: "none" }}>
                  View all incidents →
                </Link>
              </div>
            </div>

            {/* Sections grid */}
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8 }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${V.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPin size={13} color="#7c6fa0" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6fa0", letterSpacing: "0.05em" }}>
                  SECTIONS / ZONES
                </span>
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 8,
                }}
              >
                {sections.map((section) => {
                  const dot = sectionStatusDot(section.incidentCount);
                  return (
                    <Link
                      key={section.sectionId}
                      href={`${linkBase}/sections/${encodeURIComponent(section.sectionId)}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div
                        style={{
                          background: V.surfaceAlt,
                          border: `1px solid ${V.border}`,
                          borderRadius: 6,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: V.amber }}>
                          SECTION {section.sectionName}
                        </div>
                        <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 4 }}>
                          {section.level} · Gate {section.gate}
                        </div>
                        <div style={{ fontSize: 10, color: V.textSecondary, marginTop: 4 }}>
                          {section.incidentCount} incident{section.incidentCount === 1 ? "" : "s"}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10, fontWeight: 700, color: dot.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot.color }} />
                          {dot.label}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6fa0", marginBottom: 8 }}>ON DUTY</div>
              {onDuty.slice(0, 6).map((member) => (
                <Link
                  key={member.userId}
                  href={`${linkBase}/staff/${encodeURIComponent(member.userId)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: `1px solid ${V.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: V.surfaceAlt,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: V.amber,
                      }}
                    >
                      {member.initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{member.displayName}</div>
                      <div style={{ fontSize: 10, color: V.textSecondary }}>
                        {member.zone} · {member.role}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6fa0", marginBottom: 8 }}>QUICK ACTIONS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: V.surfaceAlt,
                    border: `1px solid ${V.border}`,
                    borderRadius: 6,
                    color: V.textPrimary,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Plus size={14} color={V.amber} /> New Incident
                </button>
                {canSupervisor ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setNotifyOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        background: V.surfaceAlt,
                        border: `1px solid ${V.border}`,
                        borderRadius: 6,
                        color: V.textPrimary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Volume2 size={14} color={V.amber} /> Notify Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        background: "#1a0808",
                        border: `1px solid ${V.red}`,
                        borderRadius: 6,
                        color: "#fca5a5",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      🚨 Emergency Broadcast
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {createOpen ? (
        <CreateVenueIncidentModal
          venueCode={venueCode}
          onClose={() => setCreateOpen(false)}
          onCreated={() => void refreshAll()}
        />
      ) : null}
      {notifyOpen ? <NotifyStaffModal agencyId={agencyId} onClose={() => setNotifyOpen(false)} /> : null}
      {broadcastOpen ? (
        <VenueBroadcastModal agencyId={agencyId} onClose={() => setBroadcastOpen(false)} />
      ) : null}
      {activeIncident ? (
        <IncidentCameraPanel
          agencyId={agencyId}
          incident={activeIncident}
          canDispatch={canSupervisor}
          onClose={() => setActiveIncident(null)}
        />
      ) : null}
    </VenueOperationsShell>
  );
}
