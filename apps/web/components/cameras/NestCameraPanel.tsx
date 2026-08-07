"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NestWebRTCPlayer } from "./NestWebRTCPlayer";
import { GOOGLE_NEST_TM, NEST_TM } from "@/lib/brand-marks";
import { V } from "@/lib/theme/rc-theme-tokens";

type NestConsentStatus = "AVAILABLE" | "SENT" | "APPROVED" | "DECLINED" | "DRAFT" | "EXPIRED" | "REVOKED";

type AgencyCamera = {
  deviceId: string;
  displayName: string;
  type: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
};

type CitizenCamera = {
  deviceId: string;
  displayName: string;
  distanceMeters: number;
  ownerStatus: NestConsentStatus;
  requestId?: string;
};

type ActiveStream = {
  deviceId: string;
  displayName: string;
  source: "agency" | "citizen";
};

const DURATIONS = [10, 30, 60, 120] as const;
const RADIUS_OPTIONS_METERS = [100, 250, 500, 1000, 2000] as const;

function formatRadiusLabel(meters: number): string {
  if (meters < 1609) return `${Math.round(meters * 3.28084)} ft`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function statusColor(status: NestConsentStatus | AgencyCamera["status"]): string {
  if (status === "ONLINE" || status === "APPROVED" || status === "AVAILABLE") return V.green;
  if (status === "SENT" || status === "DRAFT") return V.amber;
  if (status === "DECLINED" || status === "OFFLINE" || status === "EXPIRED") return V.red;
  return V.muted;
}

export function NestCameraPanel({
  agencyId,
  incidentId,
  incidentLat,
  incidentLng,
  onPendingCountChange,
  connectSettingsHref = "/admin/integrations",
}: {
  agencyId: string;
  incidentId: string | null;
  incidentLat?: number | null;
  incidentLng?: number | null;
  onPendingCountChange?: (count: number) => void;
  connectSettingsHref?: string;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [agencyCams, setAgencyCams] = useState<AgencyCamera[]>([]);
  const [citizenCams, setCitizenCams] = useState<CitizenCamera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<ActiveStream[]>([]);
  const [durationByDevice, setDurationByDevice] = useState<Record<string, (typeof DURATIONS)[number]>>({});
  const [busyDevice, setBusyDevice] = useState<string | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<(typeof RADIUS_OPTIONS_METERS)[number]>(500);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  const pendingCount = useMemo(
    () => citizenCams.filter((c) => c.ownerStatus === "SENT" || c.ownerStatus === "DRAFT").length,
    [citizenCams],
  );

  useEffect(() => {
    onPendingCountChange?.(pendingCount);
  }, [onPendingCountChange, pendingCount]);

  const refreshStatusAndAgency = useCallback(async () => {
    const statusRes = await fetch("/api/cameras/providers/nest/status", { credentials: "include" });
    const statusJson = (await statusRes.json()) as { connected?: boolean; error?: string };
    if (!statusRes.ok) {
      throw new Error(statusJson.error ?? `Unable to check ${NEST_TM} connection`);
    }
    const isConnected = Boolean(statusJson.connected);
    setConnected(isConnected);
    if (!isConnected) {
      setAgencyCams([]);
      return;
    }
    const camsRes = await fetch(
      `/api/cameras/providers/nest/agency-cameras?agencyId=${encodeURIComponent(agencyId)}`,
      { credentials: "include" },
    );
    const camsJson = (await camsRes.json()) as { cameras?: AgencyCamera[]; error?: string };
    if (!camsRes.ok) {
      throw new Error(camsJson.error ?? `Unable to list ${NEST_TM} agency cameras`);
    }
    setAgencyCams(camsJson.cameras ?? []);
  }, [agencyId]);

  const refreshCitizen = useCallback(async () => {
    if (!incidentId || incidentLat == null || incidentLng == null) {
      setCitizenCams([]);
      return;
    }
    const res = await fetch(
      `/api/cameras/providers/nest/available-cameras?incidentId=${encodeURIComponent(incidentId)}&radiusMeters=${radiusMeters}`,
      { credentials: "include" },
    );
    const json = (await res.json()) as {
      success?: boolean;
      data?: { cameras?: CitizenCamera[] };
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.error ?? `Unable to list nearby ${NEST_TM} cameras`);
    }
    setCitizenCams(json.data?.cameras ?? []);
  }, [incidentId, incidentLat, incidentLng, radiusMeters]);

  // Runs once on mount only — do not depend on refreshAll/refreshCitizen refs
  // (incidentLat/Lng floats from parents would retrigger and hammer Nest SDM).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await refreshStatusAndAgency();
        await refreshCitizen();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `${NEST_TM} load failed`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Citizen nearby search is Dynamo-only — safe to refresh when radius/incident changes.
  useEffect(() => {
    void refreshCitizen().catch(() => undefined);
  }, [refreshCitizen]);

  useEffect(() => {
    const hasSent = citizenCams.some((c) => c.ownerStatus === "SENT");
    if (!hasSent) return;
    const id = window.setInterval(() => {
      void refreshCitizen().catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [citizenCams, refreshCitizen]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(60);
    const timer = window.setInterval(() => {
      setRefreshCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setError(null);
    try {
      await refreshStatusAndAgency();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${NEST_TM} refresh failed`);
    }
  }, [refreshCooldown, refreshStatusAndAgency]);

  const openStream = (cam: { deviceId: string; displayName: string }, source: ActiveStream["source"]) => {
    setStreams((prev) => {
      if (prev.some((s) => s.deviceId === cam.deviceId)) return prev;
      const next = [...prev, { deviceId: cam.deviceId, displayName: cam.displayName, source }];
      return next.slice(-4);
    });
  };

  const requestAccess = async (cam: CitizenCamera) => {
    if (!incidentId) return;
    const duration = durationByDevice[cam.deviceId] ?? 30;
    const ok = window.confirm(
      `Send a ${NEST_TM} video sharing request to the camera owner?\nDuration: ${duration} minutes.`,
    );
    if (!ok) return;
    setBusyDevice(cam.deviceId);
    try {
      const res = await fetch("/api/cameras/providers/nest/request-camera-access", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          incidentId,
          deviceId: cam.deviceId,
          requestedDurationMinutes: duration,
        }),
      });
      const json = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      await refreshCitizen();
    } finally {
      setBusyDevice(null);
    }
  };

  if (connected === false) {
    return (
      <div
        className="space-y-3 rounded-lg border p-4"
        style={{ background: V.surface, borderColor: V.border }}
      >
        <p className="text-sm" style={{ color: V.text }}>
          {NEST_TM} is not connected for this agency.
        </p>
        <p className="text-xs" style={{ color: V.muted }}>
          An agency admin must complete {GOOGLE_NEST_TM} OAuth before dispatchers can view {NEST_TM}{" "}
          cameras.
        </p>
        <Link
          href={connectSettingsHref}
          className="inline-flex rounded px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: V.green }}
        >
          Connect {NEST_TM} Account
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
          Loading {NEST_TM} cameras…
        </p>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: V.muted }}>
            Agency {NEST_TM} cameras
          </h3>
          <button
            type="button"
            disabled={refreshCooldown > 0}
            onClick={() => void handleManualRefresh()}
            className="rounded border px-2 py-0.5 text-[10px] font-semibold disabled:opacity-50"
            style={{ borderColor: V.border, color: V.text }}
          >
            {refreshCooldown > 0 ? `Refresh (${refreshCooldown}s)` : "Refresh"}
          </button>
        </div>
        {agencyCams.length === 0 ? (
          <p className="text-xs" style={{ color: V.muted }}>
            No agency {NEST_TM} cameras with live stream capability.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {agencyCams.map((cam) => (
              <article
                key={cam.deviceId}
                className="rounded-lg border p-3"
                style={{ background: V.surface, borderColor: V.border }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: V.text }}>
                    {cam.displayName}
                  </p>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{ color: statusColor(cam.status), background: `${statusColor(cam.status)}22` }}
                  >
                    {cam.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openStream(cam, "agency")}
                  className="mt-3 rounded px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ background: V.green }}
                >
                  View Live Stream
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: V.muted }}>
          Nearby citizen {NEST_TM} cameras
        </h3>
        {incidentId && incidentLat != null && incidentLng != null ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: V.muted }}>
              Search radius
            </span>
            {RADIUS_OPTIONS_METERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusMeters(r)}
                className="rounded border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: radiusMeters === r ? V.green : V.border,
                  color: V.text,
                  background: radiusMeters === r ? `${V.green}22` : "transparent",
                }}
              >
                {formatRadiusLabel(r)}
              </button>
            ))}
          </div>
        ) : null}
        {!incidentId || incidentLat == null || incidentLng == null ? (
          <p className="text-xs" style={{ color: V.muted }}>
            Select an incident with a known location to search nearby citizen {NEST_TM} cameras.
          </p>
        ) : citizenCams.length === 0 ? (
          <p className="text-xs" style={{ color: V.muted }}>
            No citizen {NEST_TM} cameras within {formatRadiusLabel(radiusMeters)} of this incident.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {citizenCams.map((cam) => (
              <article
                key={cam.deviceId}
                className="rounded-lg border p-3"
                style={{ background: V.surface, borderColor: V.border }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: V.text }}>
                    {cam.displayName}
                  </p>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      color: statusColor(cam.ownerStatus),
                      background: `${statusColor(cam.ownerStatus)}22`,
                    }}
                  >
                    {cam.ownerStatus}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: V.muted }}>
                  ~{cam.distanceMeters}m away
                </p>
                {cam.ownerStatus === "AVAILABLE" || cam.ownerStatus === "DECLINED" ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {DURATIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setDurationByDevice((prev) => ({ ...prev, [cam.deviceId]: d }))
                          }
                          className="rounded border px-2 py-0.5 text-[10px]"
                          style={{
                            borderColor:
                              (durationByDevice[cam.deviceId] ?? 30) === d ? V.green : V.border,
                            color: V.text,
                          }}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busyDevice === cam.deviceId}
                      onClick={() => void requestAccess(cam)}
                      className="rounded px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: V.amber }}
                    >
                      Request Access
                    </button>
                  </div>
                ) : null}
                {cam.ownerStatus === "APPROVED" ? (
                  <button
                    type="button"
                    onClick={() => openStream(cam, "citizen")}
                    className="mt-2 rounded px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ background: V.green }}
                  >
                    View Stream
                  </button>
                ) : null}
                {cam.ownerStatus === "SENT" ? (
                  <p className="mt-2 text-[10px]" style={{ color: V.amber }}>
                    Waiting for owner consent…
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {streams.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: V.muted }}>
            Active {NEST_TM} streams ({streams.length}/4)
          </h3>
          <div className="grid gap-2 lg:grid-cols-2">
            {streams.map((s) => (
              <NestWebRTCPlayer
                key={s.deviceId}
                agencyId={agencyId}
                deviceId={s.deviceId}
                displayName={s.displayName}
                onClose={() => setStreams((prev) => prev.filter((x) => x.deviceId !== s.deviceId))}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
