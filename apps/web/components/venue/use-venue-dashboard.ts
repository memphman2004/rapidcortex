"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  VenueEventsResponse,
  VenueOnDutyStaff,
  VenueSectionSummary,
  VenueStatsResponse,
} from "rapid-cortex-shared";
import {
  fetchVenueEvents,
  fetchVenueOnDuty,
  fetchVenueSections,
  fetchVenueStats,
} from "@/lib/venue/venue-dashboard-api";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";

export function useVenueDashboard(agencyId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<VenueStatsResponse | null>(null);
  const [sections, setSections] = useState<VenueSectionSummary[]>([]);
  const [events, setEvents] = useState<VenueEventsResponse | null>(null);
  const [onDuty, setOnDuty] = useState<VenueOnDutyStaff[]>([]);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setError(null);
    try {
      const [statsRes, sectionsRes, eventsRes, onDutyRes] = await Promise.all([
        fetchVenueStats(agencyId),
        fetchVenueSections(agencyId),
        fetchVenueEvents(agencyId),
        fetchVenueOnDuty(agencyId),
      ]);
      setStats(statsRes);
      setSections(sectionsRes);
      setEvents(eventsRes);
      setOnDuty(onDutyRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load venue dashboard");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useAgencyWebSocket((msg) => {
    if (
      msg.type === "incident:created" ||
      msg.type === "incident:updated" ||
      msg.type === "staff:status-changed" ||
      msg.type === "venue:notification-sent"
    ) {
      void refresh();
    }
  });

  return { loading, error, stats, sections, events, onDuty, refresh };
}
