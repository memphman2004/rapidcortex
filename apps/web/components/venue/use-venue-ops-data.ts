"use client";

import { useCallback, useEffect, useState } from "react";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { useVenueDashboard } from "./use-venue-dashboard";

export function useVenueOpsData(agencyId: string) {
  const venueCode = extractVenueCode(agencyId);
  const dashboard = useVenueDashboard(agencyId);
  const [incidents, setIncidents] = useState<VenueIncident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  const refreshIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const rows = await fetchVenueIncidents(venueCode, {
        status: ["open", "assigned", "responding"],
      });
      setIncidents(rows.slice(0, 20));
    } catch {
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  }, [venueCode]);

  useEffect(() => {
    void refreshIncidents();
  }, [refreshIncidents]);

  const refreshAll = useCallback(async () => {
    await Promise.all([dashboard.refresh(), refreshIncidents()]);
  }, [dashboard, refreshIncidents]);

  return {
    ...dashboard,
    venueCode,
    incidents,
    incidentsLoading,
    refreshIncidents,
    refreshAll,
  };
}

export function formatVenueTimeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function mapVenueIncidentStatus(status: VenueIncident["status"]): string {
  switch (status) {
    case "open":
      return "DISPATCHED";
    case "assigned":
      return "DISPATCHED";
    case "responding":
      return "EN ROUTE";
    case "resolved":
      return "RESOLVED";
    case "escalated":
      return "ON SCENE";
    default:
      return String(status).toUpperCase();
  }
}

export function mapVenueIncidentType(type: VenueIncident["type"]): string {
  const label = type.replace(/_/g, " ").toUpperCase();
  if (label === "LOST PERSON") return "LOST CHILD";
  if (label === "GUEST SERVICES") return "FACILITIES";
  return label;
}
