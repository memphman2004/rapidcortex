"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map } from "mapbox-gl";
import { LocationMarker } from "rapid-cortex-maps/components/LocationMarker";
import { RapidCortexMap } from "rapid-cortex-maps/components/RapidCortexMap";
import type { PinpointLinkPublicView } from "rapid-cortex-shared/pinpoint-surge";
import { calculateLocationConfidence } from "rapid-cortex-shared/pinpoint-surge";

const STREAM_INTERVAL_MS = 4000;

function apiPath(token: string, sub?: string) {
  const enc = encodeURIComponent(token);
  return sub ? `/api/public/pinpoint/${enc}/${sub}` : `/api/public/pinpoint/${enc}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("empty");
  return JSON.parse(text) as T;
}

export function PinpointCallerClient({ token }: { token: string }) {
  const [data, setData] = useState<PinpointLinkPublicView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(apiPath(token), { cache: "no-store" });
    if (res.status === 410) {
      setErr("This link has expired.");
      return;
    }
    if (!res.ok) {
      setErr("We could not open this link.");
      return;
    }
    setErr(null);
    setData(await readJson<PinpointLinkPublicView>(res));
  }, [token]);

  const postLocation = useCallback(
    async (pos: GeolocationPosition) => {
      const body = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        headingDeg: pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : undefined,
        speedMps: pos.coords.speed != null && !Number.isNaN(pos.coords.speed) ? pos.coords.speed : undefined,
      };
      const res = await fetch(apiPath(token, "location"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Could not send location.");
      }
      const next = await readJson<PinpointLinkPublicView>(res);
      setData(next);
      setUpdateCount((c) => c + 1);
      setErr(null);
    },
    [token],
  );

  const stopSharing = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  }, []);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setErr("This browser does not support location.");
      return;
    }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await postLocation(pos);
          lastSentRef.current = Date.now();
          watchIdRef.current = navigator.geolocation.watchPosition(
            (update) => {
              const now = Date.now();
              if (now - lastSentRef.current < STREAM_INTERVAL_MS) return;
              lastSentRef.current = now;
              void postLocation(update).catch((e: Error) => setErr(e.message));
            },
            () => setErr("Location updates stopped — check permissions."),
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
          );
          setSharing(true);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Could not send location.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setErr("Location permission was denied or unavailable.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }, [postLocation]);

  useEffect(() => {
    void load();
    return () => stopSharing();
  }, [load, stopSharing]);

  if (!data && !err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A1628] px-4 text-slate-100">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A1628] px-4 text-center text-slate-100">
        <p className="max-w-md text-sm text-rose-200">{err}</p>
      </div>
    );
  }

  const last = data?.pings?.length ? data.pings[data.pings.length - 1] : null;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  const confidence = last?.accuracyM != null ? calculateLocationConfidence(last.accuracyM) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0A1628] px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Rapid Cortex Pinpoint</p>
        <h1 className="mt-1 text-lg font-semibold text-white">Share your location</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Emergency responders asked for your phone&apos;s GPS to find you faster. Sharing is optional and only while
          this page stays open.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Your location is only shared with emergency responders for this incident.
        </p>
        {err ? (
          <p className="mt-3 text-sm text-amber-200" role="alert">
            {err}
          </p>
        ) : null}
        {sharing ? (
          <div className="mt-4 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
            Sharing location… {updateCount > 0 ? `${updateCount} update${updateCount === 1 ? "" : "s"} sent` : ""}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {!sharing ? (
            <button
              type="button"
              onClick={startSharing}
              disabled={busy || data?.status !== "active"}
              className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Starting…" : "Share my location"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopSharing}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Stop sharing
            </button>
          )}
        </div>
        {last ? (
          <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last update</p>
              {confidence ? (
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    confidence === "high"
                      ? "bg-emerald-900/60 text-emerald-300"
                      : confidence === "medium"
                        ? "bg-amber-900/60 text-amber-200"
                        : "bg-rose-900/60 text-rose-200"
                  }`}
                >
                  {confidence} confidence
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-xs text-slate-300">
              {last.lat.toFixed(5)}, {last.lng.toFixed(5)}
              {last.accuracyM != null ? ` (±${Math.round(last.accuracyM)} m)` : ""}
            </p>
            <p className="mt-2 text-xs text-slate-500">{new Date(last.capturedAt).toLocaleString()}</p>
            {mapboxToken ? (
              <div className="mt-3 h-[220px] w-full overflow-hidden rounded-md border border-slate-800">
                <RapidCortexMap
                  theme="dark"
                  center={[last.lng, last.lat]}
                  zoom={15}
                  showControls
                  onMapLoad={setMapInstance}
                >
                  <LocationMarker
                    map={mapInstance}
                    latitude={last.lat}
                    longitude={last.lng}
                    accuracy={last.accuracyM ?? 50}
                    confidence={confidence ?? "medium"}
                  />
                </RapidCortexMap>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Map preview requires Mapbox on this host.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
