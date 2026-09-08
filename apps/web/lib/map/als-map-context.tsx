"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { withIdentityPoolId } from "@aws/amazon-location-utilities-auth-helper";
import { markMapAuthReady, setMapTransformRequest } from "rapid-cortex-maps";

export interface ALSMapConfig {
  region: string;
  mapStyleUrl: string;
  mapStyleDarkUrl: string;
  identityPoolId: string;
  authHelper: Awaited<ReturnType<typeof withIdentityPoolId>> | null;
  placeIndexName: string;
  routeCalculatorName: string;
  geofenceCollectionName: string;
  trackerName: string;
  ready: boolean;
}

const ALSMapContext = createContext<ALSMapConfig | null>(null);

function alsStyleUrl(region: string, mapName: string): string {
  return `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`;
}

export function ALSMapProvider({ children }: { children: React.ReactNode }) {
  const region = process.env.NEXT_PUBLIC_ALS_REGION?.trim() || "us-east-1";
  const mapName = process.env.NEXT_PUBLIC_ALS_MAP_NAME?.trim() || "rc-map-dev";
  const mapNameDark = process.env.NEXT_PUBLIC_ALS_MAP_NAME_DARK?.trim() || "rc-map-dark-dev";
  const identityPoolId = process.env.NEXT_PUBLIC_ALS_IDENTITY_POOL_ID?.trim() || "";

  const [authHelper, setAuthHelper] = useState<ALSMapConfig["authHelper"]>(null);
  const [ready, setReady] = useState(!identityPoolId);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!identityPoolId) {
        setMapTransformRequest(undefined);
        markMapAuthReady();
        setReady(true);
        return;
      }
      try {
        const helper = await withIdentityPoolId(identityPoolId);
        if (cancelled) return;
        setAuthHelper(helper);
        const opts = helper.getMapAuthenticationOptions();
        setMapTransformRequest(opts.transformRequest);
      } catch (err) {
        console.error("ALS auth helper init failed:", err);
      } finally {
        if (!cancelled) {
          markMapAuthReady();
          setReady(true);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [identityPoolId]);

  const value = useMemo<ALSMapConfig>(
    () => ({
      region,
      mapStyleUrl: alsStyleUrl(region, mapName),
      mapStyleDarkUrl: alsStyleUrl(region, mapNameDark),
      identityPoolId,
      authHelper,
      placeIndexName: process.env.NEXT_PUBLIC_ALS_PLACE_INDEX_NAME?.trim() || "rc-places-dev",
      routeCalculatorName: process.env.NEXT_PUBLIC_ALS_ROUTE_CALCULATOR_NAME?.trim() || "rc-routes-dev",
      geofenceCollectionName: process.env.NEXT_PUBLIC_ALS_GEOFENCE_COLLECTION?.trim() || "rc-geofences-dev",
      trackerName: process.env.NEXT_PUBLIC_ALS_TRACKER_NAME?.trim() || "rc-tracker-dev",
      ready,
    }),
    [region, mapName, mapNameDark, identityPoolId, authHelper, ready],
  );

  return <ALSMapContext.Provider value={value}>{children}</ALSMapContext.Provider>;
}

export function useALSMap(): ALSMapConfig {
  const ctx = useContext(ALSMapContext);
  if (!ctx) throw new Error("useALSMap must be used inside ALSMapProvider");
  return ctx;
}
