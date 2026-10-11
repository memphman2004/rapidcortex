"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { withIdentityPoolId } from "@aws/amazon-location-utilities-auth-helper";
import { alsMapStyleUrl, markMapAuthReady, setMapTransformRequest } from "rapid-cortex-maps";
import type { RequestTransformFunction } from "maplibre-gl";

export interface ALSMapConfig {
  region: string;
  mapStyleUrl: string;
  mapStyleDarkUrl: string;
  identityPoolId: string;
  authHelper: Awaited<ReturnType<typeof withIdentityPoolId>> | null;
  /** Set when an identity pool is configured but Cognito/ALS helper init failed. */
  authError: string | null;
  placeIndexName: string;
  routeCalculatorName: string;
  geofenceCollectionName: string;
  trackerName: string;
  ready: boolean;
}

const ALSMapContext = createContext<ALSMapConfig | null>(null);

/** Same-origin BFF proxy — works when Safari Private blocks Cognito Identity. */
const ALS_PROXY_HOST =
  /^https:\/\/maps\.geo(?:-fips)?\.[a-z0-9-]+\.(?:amazonaws\.com|api\.aws)\//i;

const alsProxyTransformRequest: RequestTransformFunction = (url) => {
  if (!ALS_PROXY_HOST.test(url)) return { url };
  return { url: `/api/map/als-proxy?url=${encodeURIComponent(url)}` };
};

export function ALSMapProvider({ children }: { children: React.ReactNode }) {
  const region = process.env.NEXT_PUBLIC_ALS_REGION?.trim() || "us-east-1";
  const identityPoolId = process.env.NEXT_PUBLIC_ALS_IDENTITY_POOL_ID?.trim() || "";
  // Prefer same-origin proxy (default on). Set NEXT_PUBLIC_ALS_USE_BROWSER_COGNITO=1 to force Cognito.
  const preferProxy = process.env.NEXT_PUBLIC_ALS_USE_BROWSER_COGNITO?.trim() !== "1";

  const [authHelper, setAuthHelper] = useState<ALSMapConfig["authHelper"]>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ready, setReady] = useState(preferProxy || !identityPoolId);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // Same-origin signed proxy: no Cognito in the browser (Safari Private safe).
      if (preferProxy) {
        setMapTransformRequest(alsProxyTransformRequest);
        setAuthHelper(null);
        setAuthError(null);
        markMapAuthReady();
        setReady(true);
        return;
      }

      if (!identityPoolId) {
        setMapTransformRequest(alsProxyTransformRequest);
        setAuthError(null);
        markMapAuthReady();
        setReady(true);
        return;
      }
      try {
        const helper = await withIdentityPoolId(identityPoolId);
        if (cancelled) return;
        setAuthHelper(helper);
        setAuthError(null);
        const opts = helper.getMapAuthenticationOptions();
        // getMapAuthenticationOptions() also wraps V2 tile signing; set the raw helper fn.
        setMapTransformRequest(opts.transformRequest);
      } catch (err) {
        console.error("ALS auth helper init failed:", err);
        if (!cancelled) {
          // Fall back to same-origin proxy so maps still paint.
          setAuthHelper(null);
          setMapTransformRequest(alsProxyTransformRequest);
          setAuthError(null);
        }
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
  }, [identityPoolId, preferProxy]);

  const value = useMemo<ALSMapConfig>(
    () => ({
      region,
      mapStyleUrl: alsMapStyleUrl("light"),
      mapStyleDarkUrl: alsMapStyleUrl("dark"),
      identityPoolId,
      authHelper,
      authError,
      placeIndexName: process.env.NEXT_PUBLIC_ALS_PLACE_INDEX_NAME?.trim() || "rc-places-dev",
      routeCalculatorName: process.env.NEXT_PUBLIC_ALS_ROUTE_CALCULATOR_NAME?.trim() || "rc-routes-dev",
      geofenceCollectionName: process.env.NEXT_PUBLIC_ALS_GEOFENCE_COLLECTION?.trim() || "rc-geofences-dev",
      trackerName: process.env.NEXT_PUBLIC_ALS_TRACKER_NAME?.trim() || "rc-tracker-dev",
      ready,
    }),
    [region, identityPoolId, authHelper, authError, ready],
  );

  return <ALSMapContext.Provider value={value}>{children}</ALSMapContext.Provider>;
}

export function useALSMap(): ALSMapConfig {
  const ctx = useContext(ALSMapContext);
  if (!ctx) throw new Error("useALSMap must be used inside ALSMapProvider");
  return ctx;
}
