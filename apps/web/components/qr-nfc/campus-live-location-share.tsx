"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { SAFETY_BRAND } from "./safety-reporting/tokens";

function apiPath(token: string, sub?: string) {
  const enc = encodeURIComponent(token);
  return sub ? `/api/public/pinpoint/${enc}/${sub}` : `/api/public/pinpoint/${enc}`;
}

/**
 * After a campus QR report, stream GPS to the browser Pinpoint session.
 * Reuses the public Pinpoint location endpoint (same as PinpointCallerClient).
 */
export function CampusLiveLocationShare({ token }: { token: string }) {
  const [sharing, setSharing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [revokePending, setRevokePending] = useState(false);
  const [serverRevokeFailed, setServerRevokeFailed] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

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

  const stop = useCallback(async () => {
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
        "Stopped on this device, but the server did not confirm revocation. Tap Retry to confirm stop.",
      );
    } finally {
      setRevokePending(false);
    }
  }, [clearWatch, revokeOnServer]);

  const postLocation = useCallback(
    async (pos: GeolocationPosition) => {
      const body = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        headingDeg:
          pos.coords.heading != null && !Number.isNaN(pos.coords.heading)
            ? pos.coords.heading
            : undefined,
        speedMps:
          pos.coords.speed != null && !Number.isNaN(pos.coords.speed) ? pos.coords.speed : undefined,
      };
      const res = await fetch(apiPath(token, "location"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 410) {
        clearWatch();
        setSharing(false);
        throw new Error("Location sharing ended — this session was revoked or expired.");
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Could not send location.");
      }
      setUpdateCount((c) => c + 1);
      setErr(null);
    },
    [token, clearWatch],
  );

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setErr("Location is not available on this device.");
      return;
    }
    setErr(null);
    setServerRevokeFailed(false);
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void postLocation(pos).catch((e: unknown) => {
          setErr(e instanceof Error ? e.message : "Could not send location.");
        });
      },
      (geoErr) => {
        setErr(geoErr.message || "Location permission denied.");
        void stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }, [postLocation, stop]);

  useEffect(() => {
    // pagehide only — React unmount / Strict Mode must not revoke the session.
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

  // Auto-start once — consent was already given on the report form (shareLiveLocation).
  useEffect(() => {
    start();
    return () => clearWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per token
  }, [token]);

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{ borderColor: SAFETY_BRAND.border, backgroundColor: "#F8FAFC" }}
    >
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SAFETY_BRAND.deepBlue }} />
        <div className="min-w-0 flex-1 text-sm" style={{ color: SAFETY_BRAND.textDark }}>
          <p className="font-semibold">
            {sharing ? "Sharing live location" : "Location sharing stopped"}
          </p>
          <p className="mt-1 text-xs" style={{ color: SAFETY_BRAND.muted }}>
            Keep this screen on so responders can find you if you move.{" "}
            {updateCount > 0 ? `${updateCount} update${updateCount === 1 ? "" : "s"} sent.` : null}
          </p>
          {err ? (
            <p className="mt-2 text-xs text-rose-600" role="alert">
              {err}
            </p>
          ) : null}
          {sessionEnded ? (
            <p className="mt-3 text-xs font-medium" style={{ color: SAFETY_BRAND.muted }}>
              Sharing ended for this session. Responders will no longer receive new GPS updates from
              this link.
            </p>
          ) : sharing ? (
            <button
              type="button"
              onClick={() => void stop()}
              disabled={revokePending}
              className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
            >
              {revokePending ? "Stopping…" : "Stop sharing"}
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {serverRevokeFailed ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  disabled={revokePending}
                  className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50"
                >
                  Retry confirm stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={start}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: SAFETY_BRAND.deepBlue }}
                >
                  Resume sharing
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
