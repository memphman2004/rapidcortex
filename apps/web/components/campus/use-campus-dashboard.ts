"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CampusBuildingSummary,
  CampusOnDutyStaff,
  CampusStatsResponse,
  CampusThreatLevel,
  CampusZoneSummary,
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
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";

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
  refresh: () => Promise<void>;
  setThreatLevel: (level: UiThreatLevel) => Promise<void>;
};

export function useCampusDashboard(agencyId: string, campusCode: string): CampusDashboardState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CampusStatsResponse | null>(null);
  const [zones, setZones] = useState<CampusZoneSummary[]>([]);
  const [buildings, setBuildings] = useState<CampusBuildingSummary[]>([]);
  const [onDuty, setOnDuty] = useState<CampusOnDutyStaff[]>([]);
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [threatLevel, setThreatLevelState] = useState<UiThreatLevel>("secure");

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
          fetchCampusOpenIncidents(campusCode, 20),
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
  }, [agencyId, campusCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useAgencyWebSocket((msg) => {
    if (
      msg.type === "incident:created" ||
      msg.type === "incident:updated" ||
      msg.type === "staff:status-changed"
    ) {
      void refresh();
      return;
    }
    if (msg.type === "campus:threat-level-changed") {
      const level = msg.data.level;
      if (typeof level === "string") {
        setThreatLevelState(apiThreatToUi(level as CampusThreatLevel));
      }
    }
  });

  const setThreatLevel = useCallback(
    async (level: UiThreatLevel) => {
      const updated = await patchCampusThreatLevel(agencyId, uiThreatToApi(level));
      setThreatLevelState(apiThreatToUi(updated.level));
    },
    [agencyId],
  );

  return {
    loading,
    error,
    stats,
    zones,
    buildings,
    onDuty,
    incidents,
    threatLevel,
    refresh,
    setThreatLevel,
  };
}
