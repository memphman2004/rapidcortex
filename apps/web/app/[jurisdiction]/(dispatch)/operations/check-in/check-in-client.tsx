"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  MapPin,
  Plus,
  Shield,
  Timer,
  X,
} from "lucide-react";
import type { CheckInTimer, PanicAlert } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";

const SURFACE = "bg-[#161b2e] border border-[#1e2130]";
const INPUT =
  "rounded-md border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e4ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#378ADD]";

const DURATIONS = [5, 10, 15, 30] as const;

type Props = { jurisdiction: string; agencyId: string; userId: string };

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(expiresAt: string, now: number): {
  label: string;
  urgent: boolean;
  expired: boolean;
} {
  const ms = new Date(expiresAt).getTime() - now;
  const expired = ms <= 0;
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return {
    label: expired ? "EXPIRED" : `${m}:${String(s).padStart(2, "0")}`,
    urgent: ms > 0 && ms < 120_000,
    expired,
  };
}

export function CheckInClient({ agencyId, userId }: Props) {
  const qc = useQueryClient();
  const now = useNow();
  const [showStart, setShowStart] = useState(false);
  const [form, setForm] = useState({
    unitId: "",
    unitName: "",
    durationMinutes: 10 as (typeof DURATIONS)[number],
    incidentId: "",
    incidentAddress: "",
  });

  const query = useQuery({
    queryKey: ["feature-checkin", agencyId],
    queryFn: () =>
      featureSuiteFetch<{ timers: CheckInTimer[]; panics: PanicAlert[] }>(
        "checkin/active",
      ),
    refetchInterval: 15_000,
  });

  const timers = query.data?.timers ?? [];
  const panics = query.data?.panics ?? [];

  const startMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch("checkin/timers", {
        method: "POST",
        body: JSON.stringify({
          unitId: form.unitId.trim(),
          unitName: form.unitName.trim() || form.unitId.trim(),
          durationMinutes: form.durationMinutes,
          incidentId: form.incidentId.trim() || undefined,
          incidentAddress: form.incidentAddress.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-checkin", agencyId] });
      setShowStart(false);
      setForm({
        unitId: "",
        unitName: "",
        durationMinutes: 10,
        incidentId: "",
        incidentAddress: "",
      });
    },
  });

  const checkInMut = useMutation({
    mutationFn: (id: string) =>
      featureSuiteFetch(`checkin/timers/${id}/check-in`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-checkin", agencyId] });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      featureSuiteFetch(`checkin/timers/${id}/cancel`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-checkin", agencyId] });
    },
  });

  const panicMut = useMutation({
    mutationFn: (payload: { unitId: string; unitName: string; incidentId?: string }) =>
      featureSuiteFetch("checkin/panic", {
        method: "POST",
        body: JSON.stringify({
          unitId: payload.unitId,
          unitName: payload.unitName,
          triggeredBy: "button",
          incidentId: payload.incidentId,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-checkin", agencyId] });
    },
  });

  const sortedTimers = useMemo(
    () =>
      [...timers].sort(
        (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      ),
    [timers],
  );

  return (
    <div className="min-h-full bg-[#0f1117] p-4 text-[#e2e4ea] md:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Shield className="h-5 w-5 text-[#378ADD]" />
            Responder Safety Check-in
          </h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            Active timers, escalations, and panic alerts for field units.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3 py-2 text-sm font-medium text-white"
          onClick={() => setShowStart(true)}
        >
          <Plus className="h-4 w-4" />
          Start check-in timer
        </button>
      </header>

      {panics.length > 0 ? (
        <div className="mb-4 space-y-2">
          {panics.map((alert) => (
            <div
              key={alert.alertId}
              className="rounded-lg border border-[#E24B4A] bg-[#E24B4A]/15 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-2 font-semibold text-[#E24B4A]">
                    <AlertTriangle className="h-4 w-4" />
                    PANIC ALERT — {alert.unitName}
                  </p>
                  <p className="mt-1 text-xs text-[#e2e4ea]">
                    Triggered {new Date(alert.triggeredAt).toLocaleString()}
                    {alert.lat != null && alert.lon != null ? (
                      <>
                        {" · "}
                        <a
                          className="inline-flex items-center gap-1 text-[#378ADD] hover:underline"
                          href={`https://maps.google.com/?q=${alert.lat},${alert.lon}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="h-3 w-3" />
                          {alert.lat.toFixed(4)}, {alert.lon.toFixed(4)}
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-[#161b2e] px-2.5 py-1.5 text-xs"
                    onClick={() =>
                      void qc.invalidateQueries({ queryKey: ["feature-checkin", agencyId] })
                    }
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-[#E24B4A] px-2.5 py-1.5 text-xs font-medium text-white"
                    onClick={() =>
                      void qc.invalidateQueries({ queryKey: ["feature-checkin", agencyId] })
                    }
                  >
                    Resolved
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showStart ? (
        <div className={`${SURFACE} mb-4 space-y-3 rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Start timer</h2>
            <button
              type="button"
              className="rounded p-1 text-[#9ca3af]"
              onClick={() => setShowStart(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className={INPUT}
              placeholder="Unit ID"
              value={form.unitId}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
            />
            <input
              className={INPUT}
              placeholder="Unit name"
              value={form.unitName}
              onChange={(e) => setForm((f) => ({ ...f, unitName: e.target.value }))}
            />
            <label className="flex flex-col gap-1 text-xs text-[#9ca3af]">
              Duration
              <select
                className={INPUT}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    durationMinutes: Number(e.target.value) as (typeof DURATIONS)[number],
                  }))
                }
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </select>
            </label>
            <input
              className={INPUT}
              placeholder="Incident ID (optional)"
              value={form.incidentId}
              onChange={(e) => setForm((f) => ({ ...f, incidentId: e.target.value }))}
            />
            <input
              className={`${INPUT} md:col-span-2`}
              placeholder="Incident address"
              value={form.incidentAddress}
              onChange={(e) => setForm((f) => ({ ...f, incidentAddress: e.target.value }))}
            />
          </div>
          <button
            type="button"
            className="rounded-md bg-[#378ADD] px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!form.unitId.trim() || startMut.isPending}
            onClick={() => startMut.mutate()}
          >
            Start timer
          </button>
          {startMut.isError ? (
            <p className="text-xs text-[#E24B4A]">{(startMut.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Active timers ({sortedTimers.length})
        </h2>
        {query.isLoading ? (
          <p className="text-sm text-[#9ca3af]">Loading timers…</p>
        ) : query.isError ? (
          <p className="text-sm text-[#E24B4A]">{(query.error as Error).message}</p>
        ) : sortedTimers.length === 0 ? (
          <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
            No active check-in timers.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedTimers.map((timer) => {
              const cd = formatCountdown(timer.expiresAt, now);
              return (
                <article
                  key={timer.timerId}
                  className={`${SURFACE} rounded-lg p-4 ${
                    cd.expired ? "animate-pulse border-[#E24B4A]" : ""
                  }`}
                >
                  {timer.status === "escalated" || timer.escalationLevel ? (
                    <div className="mb-2 rounded bg-[#E24B4A]/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#E24B4A]">
                      Escalation level:{" "}
                      {(timer.escalationLevel ?? "supervisor_alert").replace(/_/g, " ")}
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{timer.unitName}</h3>
                      <p className="text-xs text-[#9ca3af]">
                        {timer.incidentAddress || "No address"}
                        {timer.incidentId ? ` · ${timer.incidentId}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-[#6b7280]">
                        Started by {timer.dispatcherId}
                        {timer.dispatcherId === userId ? " (you)" : ""}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-sm font-semibold ${
                        cd.expired || cd.urgent
                          ? "bg-[#E24B4A]/20 text-[#E24B4A]"
                          : "bg-[#1a2035] text-[#e2e4ea]"
                      }`}
                    >
                      <Timer className="h-3.5 w-3.5" />
                      {cd.label}
                    </div>
                  </div>
                  <p className="mt-2 text-xs capitalize text-[#6b7280]">
                    Status: {timer.status.replace(/_/g, " ")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-[#1D9E75] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={checkInMut.isPending}
                      onClick={() => checkInMut.mutate(timer.timerId)}
                    >
                      Check in unit
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-[#1a2035] px-2.5 py-1.5 text-xs disabled:opacity-50"
                      disabled={cancelMut.isPending}
                      onClick={() => cancelMut.mutate(timer.timerId)}
                    >
                      Cancel timer
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-[#E24B4A]/90 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={panicMut.isPending}
                      onClick={() =>
                        panicMut.mutate({
                          unitId: timer.unitId,
                          unitName: timer.unitName,
                          incidentId: timer.incidentId,
                        })
                      }
                    >
                      Trigger panic
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
