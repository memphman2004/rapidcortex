"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CampusBuildingSummary,
  CampusOnDutyStaff,
  CampusStatsResponse,
  CampusThreatLevel,
  CampusZoneSummary,
  VenueIncidentCameraSummary,
} from "rapid-cortex-shared";
import {
  fetchCampusBuildings,
  fetchCampusOnDuty,
  fetchCampusOpenIncidents,
  fetchCampusStats,
  fetchCampusThreatLevel,
  fetchCampusZones,
  patchCampusThreatLevel,
} from "@/lib/campus/campus-dashboard-api";
import type { CampusIncident } from "@/lib/campus/types";
import { useSession } from "@/components/auth/session-context";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import type { VenueActiveIncidentPanel } from "@/components/venue/IncidentCameraPanel";

export type UiThreatLevel = "secure" | "elevated" | "high" | "lockdown";

export function apiThreatToUi(level: CampusThreatLevel): UiThreatLevel {
  if (level === "high_alert") return "high";
  return level;
}

export function uiThreatToApi(level: UiThreatLevel): CampusThreatLevel {
  if (level === "high") return "high_alert";
  return level;
}

export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function mapIncidentStatus(status: CampusIncident["status"]): string {
  switch (status) {
    case "open":
      return "DISPATCHED";
    case "assigned":
      return "DISPATCHED";
    case "responding":
      return "EN ROUTE";
    case "resolved":
    case "referred":
    case "escalated":
      return "CLOSED";
  }
}

export function mapIncidentType(type: CampusIncident["type"]): string {
  return type.replace(/_/g, " ").toUpperCase();
}

export type CampusDashboardState = {
  loading: boolean;
  error: string | null;
  stats: CampusStatsResponse | null;
  zones: CampusZoneSummary[];
  buildings: CampusBuildingSummary[];
  onDuty: CampusOnDutyStaff[];
  incidents: CampusIncident[];
  threatLevel: UiThreatLevel;
  activeCameraIncident: VenueActiveIncidentPanel | null;
  clearActiveCameraIncident: () => void;
  refresh: () => Promise<void>;
  setThreatLevel: (level: UiThreatLevel) => Promise<void>;
};

export function useCampusDashboard(agencyId: string, campusCode: string): CampusDashboardState {
  const { user } = useSession();
  const counselorQueue = (user?.role ?? "").trim().toUpperCase() === "CAMPUS_COUNSELOR";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CampusStatsResponse | null>(null);
  const [zones, setZones] = useState<CampusZoneSummary[]>([]);
  const [buildings, setBuildings] = useState<CampusBuildingSummary[]>([]);
  const [onDuty, setOnDuty] = useState<CampusOnDutyStaff[]>([]);
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [threatLevel, setThreatLevelState] = useState<UiThreatLevel>("secure");
  const [activeCameraIncident, setActiveCameraIncident] = useState<VenueActiveIncidentPanel | null>(
    null,
  );

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setError(null);
    try {
      const [statsRes, zonesRes, buildingsRes, onDutyRes, incidentsRes, threatRes] =
        await Promise.all([
          fetchCampusStats(agencyId),
          fetchCampusZones(agencyId),
          fetchCampusBuildings(agencyId),
          fetchCampusOnDuty(agencyId),
          fetchCampusOpenIncidents(campusCode, 20, { counselorQueue }),
          fetchCampusThreatLevel(agencyId),
        ]);
      setStats(statsRes);
      setZones(zonesRes);
      setBuildings(buildingsRes);
      setOnDuty(onDutyRes);
      setIncidents(incidentsRes);
      setThreatLevelState(apiThreatToUi(threatRes.level));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [agencyId, campusCode, counselorQueue]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCameraPanel = useCallback(
    async (data: Record<string, unknown>) => {
      const incidentId = String(data.incidentId ?? "");
      const section = String(data.section ?? "");
      const qrRcli = String(data.qrRcli ?? "");
      if (!incidentId) return;

      let cameras = (data.cameras as VenueIncidentCameraSummary[] | undefined) ?? [];
      if (cameras.length === 0 && (section || qrRcli)) {
        try {
          cameras = await fetchVenueSectionCameras(agencyId, section || "UNKNOWN", 2, "campus", {
            qrRcli: qrRcli || undefined,
          });
        } catch {
          cameras = [];
        }
      }
      if (!section && cameras.length === 0) return;

      setActiveCameraIncident({
        incidentId,
        section: section || "QR",
        reportType: String(data.reportType ?? "incident"),
        location: String(data.location ?? (section ? `Building ${section}` : "QR location")),
        cameras,
        createdAt: String(data.createdAt ?? new Date().toISOString()),
      });
    },
    [agencyId],
  );

  useAgencyWebSocket((msg) => {
    if (
      msg.type === "incident:created" ||
      msg.type === "incident:updated" ||
      msg.type === "staff:status-changed"
    ) {
      void refresh();
      if (msg.type === "incident:created") {
        void openCameraPanel(msg.data);
      }
      return;
    }
    if (msg.type === "campus:threat-level-changed") {
      const level = msg.data.level;
      if (typeof level === "string") {
        setThreatLevelState(apiThreatToUi(level as CampusThreatLevel));
      }
      return;
    }
    if (msg.type === "camera:offline" && activeCameraIncident) {
      const cameraId = String(msg.data.cameraId ?? "");
      const sections = (msg.data.sections as string[] | undefined) ?? [];
      const buildingId = String(msg.data.buildingId ?? "");
      const matchesSection =
        sections.includes(activeCameraIncident.section) ||
        buildingId === activeCameraIncident.section;
      if (!cameraId || !matchesSection) return;
      void (async () => {
        const replacements = await fetchVenueSectionCameras(
          agencyId,
          activeCameraIncident.section,
          10,
          "campus",
        );
        setActiveCameraIncident((prev) => {
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

  const setThreatLevel = useCallback(
    async (level: UiThreatLevel) => {
      const updated = await patchCampusThreatLevel(agencyId, uiThreatToApi(level));
      setThreatLevelState(apiThreatToUi(updated.level));
    },
    [agencyId],
  );

  const clearActiveCameraIncident = useCallback(() => setActiveCameraIncident(null), []);

  return {
    loading,
    error,
    stats,
    zones,
    buildings,
    onDuty,
    incidents,
    threatLevel,
    activeCameraIncident,
    clearActiveCameraIncident,
    refresh,
    setThreatLevel,
  };
}
