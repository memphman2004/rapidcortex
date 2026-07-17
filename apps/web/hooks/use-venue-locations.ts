"use client";

import { useCallback, useEffect, useState } from "react";
import type { QRLocation, QRLocationVertical } from "rapid-cortex-shared";
import { fetchVenueLocations } from "@/lib/venue/venue-locations-api";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";

export function useVenueLocations(agencyId: string, vertical: QRLocationVertical) {
  const [locations, setLocations] = useState<QRLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setError(null);
    try {
      const result = await fetchVenueLocations(agencyId, vertical);
      setLocations(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load locations");
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, vertical]);

  useEffect(() => {
    void load();
  }, [load]);

  useAgencyWebSocket((msg) => {
    if (msg.type === "location:created" || msg.type === "location:updated" || msg.type === "location:deactivated") {
      void load();
    }
  });

  return { locations, isLoading, error, refresh: load };
}
