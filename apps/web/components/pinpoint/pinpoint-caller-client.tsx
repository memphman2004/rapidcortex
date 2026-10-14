"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
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
  const [revokePending, setRevokePending] = useState(false);
  const [serverRevokeFailed, setServerRevokeFailed] = useState(false);
  /** True after server-confirmed revoke — same token cannot resume. */
  const [sessionEnded, setSessionEnded] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(apiPath(token), { cache: "no-store" });
    if (res.status === 410) {
      setErr("This link has expired or was revoked.");
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
      if (res.status === 410) {
        clearWatch();
        setSharing(false);
        throw new Error("Location sharing ended — this link was revoked or expired.");
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Could not send location.");
      }
      const next = await readJson<PinpointLinkPublicView>(res);
      setData(next);
      if (typeof next.updateCount === "number") setUpdateCount(next.updateCount);
      else setUpdateCount((c) => c + 1);
      setErr(null);
    },
    [token, clearWatch],
  );

  const revokeOnServer = useCallback(
    async (reason: "caller_stop" | "browser_interrupt") => {
      const res = await fetch(apiPath(token, "revoke"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        throw new Error("Server could not confirm that sharing stopped.");
      }
    },
    [token],
  );

  const stopSharing = useCallback(async () => {
    // Privacy-first: stop the browser watch immediately, then confirm with the server.
    clearWatch();
    setSharing(false);
    setRevokePending(true);
    setServerRevokeFailed(false);
    try {
      await revokeOnServer("caller_stop");
      setErr(null);
      setServerRevokeFailed(false);
      setSessionEnded(true);
    } catch {
      setServerRevokeFailed(true);
      setErr(
        "Stopped on this device, but the server did not confirm revocation. Tap Retry to confirm stop with responders.",
      );
    } finally {
      setRevokePending(false);
    }
  }, [clearWatch, revokeOnServer]);

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
  }, [load]);

  useEffect(() => {
    // pagehide/beforeunload only — React unmount (Strict Mode) must not revoke the session.
    const onPageHide = () => {
      clearWatch();
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([JSON.stringify({ reason: "browser_interrupt" })], {
          type: "application/json",
        });
        navigator.sendBeacon(apiPath(token, "revoke"), blob);
        return;
      }
      void revokeOnServer("browser_interrupt").catch(() => {
        /* ignore */
      });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearWatch();
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [clearWatch, revokeOnServer, token]);

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

  const last = data?.lastAccepted ?? null;
  const confidence = last?.accuracyM != null ? calculateLocationConfidence(last.accuracyM) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0A1628] px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">NexiQ Pinpoint</p>
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
            Sharing location… {updateCount > 0 ? `${updateCount} update${updateCount === 1 ? "" : "s"} accepted` : ""}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {sessionEnded ? (
            <p className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-3 text-sm text-slate-300">
              Location sharing has ended for this link. Responders can no longer receive new GPS updates
              from this session.
            </p>
          ) : !sharing ? (
            <button
              type="button"
              onClick={startSharing}
              disabled={busy || !data?.sharingAllowed}
              className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Starting…" : "Share my location"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopSharing()}
              disabled={revokePending}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {revokePending ? "Stopping…" : "Stop sharing"}
            </button>
          )}
          {serverRevokeFailed ? (
            <button
              type="button"
              onClick={() => void stopSharing()}
              disabled={revokePending}
              className="w-full rounded-lg border border-amber-700/60 bg-amber-950/40 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
            >
              Retry confirm stop with server
            </button>
          ) : null}
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
