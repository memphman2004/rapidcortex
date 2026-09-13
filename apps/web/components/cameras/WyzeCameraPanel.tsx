"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WyzeWebRTCPlayer } from "./WyzeWebRTCPlayer";
import { WYZE_TM } from "@/lib/brand-marks";
import { V } from "@/lib/theme/rc-theme-tokens";
import { marketingWyzeConnectPath } from "@/lib/marketing-links";

type ConsentStatus = "AVAILABLE" | "SENT" | "APPROVED" | "DECLINED" | "DRAFT" | "EXPIRED" | "NO_PHONE";

type CitizenCamera = {
  mac: string;
  displayName: string;
  distanceMeters: number;
  ownerStatus: ConsentStatus;
  requestId?: string;
};

type ActiveStream = { mac: string; displayName: string };

const DURATIONS = [10, 30, 60, 120] as const;
const RADIUS_OPTIONS_METERS = [100, 250, 500, 1000, 2000] as const;

function formatRadiusLabel(meters: number): string {
  if (meters < 1609) return `${Math.round(meters * 3.28084)} ft`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function statusColor(status: ConsentStatus): string {
  if (status === "APPROVED" || status === "AVAILABLE") return V.green;
  if (status === "SENT" || status === "DRAFT") return V.amber;
  if (status === "DECLINED" || status === "EXPIRED" || status === "NO_PHONE") return V.red;
  return V.muted;
}

export function WyzeCameraPanel({
  agencyId,
  incidentId,
  onPendingCountChange,
}: {
  agencyId: string;
  incidentId: string | null;
  incidentLat?: number | null;
  incidentLng?: number | null;
  onPendingCountChange?: (count: number) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [citizenCams, setCitizenCams] = useState<CitizenCamera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<ActiveStream[]>([]);
  const [durationByDevice, setDurationByDevice] = useState<Record<string, (typeof DURATIONS)[number]>>({});
  const [busyDevice, setBusyDevice] = useState<string | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<(typeof RADIUS_OPTIONS_METERS)[number]>(500);

  const pendingCount = useMemo(
    () => citizenCams.filter((c) => c.ownerStatus === "SENT" || c.ownerStatus === "DRAFT").length,
    [citizenCams],
  );

  useEffect(() => {
    onPendingCountChange?.(pendingCount);
  }, [onPendingCountChange, pendingCount]);

  const refreshCitizen = useCallback(async () => {
    if (!incidentId) {
      setCitizenCams([]);
      return;
    }
    const res = await fetch(
      `/api/cameras/providers/wyze/available-cameras?incidentId=${encodeURIComponent(incidentId)}&radiusMeters=${radiusMeters}`,
      { credentials: "include" },
    );
    if (res.status === 404 || res.status === 503) {
      setEnabled(false);
      setCitizenCams([]);
      return;
    }
    const json = (await res.json()) as {
      data?: { cameras?: Array<Record<string, unknown>> };
      error?: string;
    };
    if (!res.ok) {
      setError(json.error ?? `Unable to load ${WYZE_TM} cameras (${res.status})`);
      return;
    }
    setEnabled(true);
    const cams = (json.data?.cameras ?? []).map((c) => ({
      mac: String(c.mac ?? ""),
      displayName: String(c.displayName ?? c.mac ?? "Wyze camera"),
      distanceMeters: Number(c.distanceMeters ?? 0),
      ownerStatus: (c.ownerStatus as ConsentStatus) ?? "AVAILABLE",
      requestId: c.requestId ? String(c.requestId) : undefined,
    }));
    setCitizenCams(cams.filter((c) => c.mac));
  }, [incidentId, radiusMeters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const statusRes = await fetch("/api/cameras/providers/wyze/status", { credentials: "include" });
        if (cancelled) return;
        if (statusRes.status === 404 || statusRes.status === 503) {
          setEnabled(false);
          return;
        }
        setEnabled(statusRes.ok);
        await refreshCitizen();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Wyze status failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCitizen]);

  const requestAccess = async (cam: CitizenCamera) => {
    if (!incidentId) return;
    const duration = durationByDevice[cam.mac] ?? 30;
    const ok = window.confirm(
      `Send a ${WYZE_TM} video sharing request to the camera owner?\nDuration: ${duration} minutes.`,
    );
    if (!ok) return;
    setBusyDevice(cam.mac);
    try {
      const res = await fetch("/api/cameras/providers/wyze/request-camera-access", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          incidentId,
          mac: cam.mac,
          requestedDurationMinutes: duration,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      await refreshCitizen();
    } finally {
      setBusyDevice(null);
    }
  };

  if (enabled === false) {
    return (
      <div
        className="space-y-3 rounded-lg border p-4"
        style={{ background: V.surface, borderColor: V.border }}
      >
        <p className="text-sm" style={{ color: V.text }}>
          {WYZE_TM} Connect is not enabled in this environment yet.
        </p>
        <p className="text-xs" style={{ color: V.muted }}>
          Homeowners enroll at the public {WYZE_TM} Connect page. Deploy with WyzeEnabled=true after
          rotating the API-keys secret.
        </p>
        <Link
          href={marketingWyzeConnectPath()}
          className="inline-flex rounded px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: V.green }}
        >
          Homeowner enrollment
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-xs" style={{ color: V.red }}>
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-xs" style={{ color: V.muted }}>
          Loading {WYZE_TM} cameras…
        </p>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: V.muted }}>
            Nearby {WYZE_TM} ({citizenCams.length})
          </h3>
          <select
            className="rounded border bg-transparent px-2 py-1 text-[11px]"
            style={{ borderColor: V.border, color: V.text }}
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value) as (typeof RADIUS_OPTIONS_METERS)[number])}
          >
            {RADIUS_OPTIONS_METERS.map((m) => (
              <option key={m} value={m}>
                {formatRadiusLabel(m)}
              </option>
            ))}
          </select>
        </div>
        {!incidentId ? (
          <p className="text-xs" style={{ color: V.muted }}>
            Select an incident to search nearby {WYZE_TM} cameras.
          </p>
        ) : citizenCams.length === 0 ? (
          <p className="text-xs" style={{ color: V.muted }}>
            No enrolled {WYZE_TM} cameras within {formatRadiusLabel(radiusMeters)} of this incident.
            Share {marketingWyzeConnectPath()} with homeowners (agency {agencyId}).
          </p>
        ) : (
          <ul className="space-y-2">
            {citizenCams.map((cam) => (
              <li
                key={cam.mac}
                className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
                style={{ borderColor: V.border }}
              >
                <div>
                  <p className="text-xs font-medium" style={{ color: V.text }}>
                    {cam.displayName}
                  </p>
                  <p className="text-[11px]" style={{ color: statusColor(cam.ownerStatus) }}>
                    {cam.ownerStatus} · {formatRadiusLabel(cam.distanceMeters)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {cam.ownerStatus === "APPROVED" ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-[11px] font-semibold text-white"
                      style={{ background: V.green }}
                      onClick={() =>
                        setStreams((prev) =>
                          prev.some((s) => s.mac === cam.mac)
                            ? prev
                            : [...prev, { mac: cam.mac, displayName: cam.displayName }].slice(-4),
                        )
                      }
                    >
                      View live
                    </button>
                  ) : (
                    <>
                      <select
                        className="rounded border bg-transparent px-1 py-1 text-[11px]"
                        style={{ borderColor: V.border, color: V.text }}
                        value={durationByDevice[cam.mac] ?? 30}
                        onChange={(e) =>
                          setDurationByDevice((d) => ({
                            ...d,
                            [cam.mac]: Number(e.target.value) as (typeof DURATIONS)[number],
                          }))
                        }
                      >
                        {DURATIONS.map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyDevice === cam.mac || cam.ownerStatus === "SENT"}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                        style={{ background: V.green }}
                        onClick={() => void requestAccess(cam)}
                      >
                        Request
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {incidentId
        ? streams.map((s) => (
            <WyzeWebRTCPlayer
              key={s.mac}
              mac={s.mac}
              incidentId={incidentId}
              displayName={s.displayName}
              onClose={() => setStreams((prev) => prev.filter((x) => x.mac !== s.mac))}
            />
          ))
        : null}
    </div>
  );
}
