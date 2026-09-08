"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isVerticalAlertWsType,
  type AlertDispatchJob,
  type AlertSeverity,
  type AlertTemplateType,
} from "rapid-cortex-shared";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import { isVerticalAlertsEnabled } from "@/lib/runtime-flags";

type OverlayAlert = {
  jobId: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  type: AlertTemplateType;
  sentAt: string;
};

const ACK_KEY = (jobId: string) => `rc-vertical-alert-ack:${jobId}`;

function wasAcked(jobId: string): boolean {
  try {
    return sessionStorage.getItem(ACK_KEY(jobId)) === "1";
  } catch {
    return false;
  }
}

function markAcked(jobId: string): void {
  try {
    sessionStorage.setItem(ACK_KEY(jobId), "1");
  } catch {
    /* ignore quota */
  }
}

function toOverlay(job: Pick<AlertDispatchJob, "jobId" | "title" | "body" | "severity" | "templateType" | "initiatedAt">): OverlayAlert {
  return {
    jobId: job.jobId,
    title: job.title,
    body: job.body,
    severity: job.severity,
    type: job.templateType,
    sentAt: job.initiatedAt,
  };
}

export function VerticalAlertOverlay() {
  const enabled = isVerticalAlertsEnabled();
  const [alert, setAlert] = useState<OverlayAlert | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);
  const shownRef = useRef<string | null>(null);

  const show = useCallback((next: OverlayAlert) => {
    if (wasAcked(next.jobId)) return;
    shownRef.current = next.jobId;
    setAlert(next);
    setAckError(null);
  }, []);

  const wsUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim() : "";
  useAgencyWebSocket(
    useCallback(
      (message) => {
        if (!isVerticalAlertWsType(message.type)) return;
        const data = message.data;
        const jobId = String(data.jobId ?? "");
        const title = String(data.title ?? "Emergency alert");
        const body = String(data.body ?? "");
        if (!jobId || !body) return;
        show({
          jobId,
          title,
          body,
          severity: (data.severity as AlertSeverity) || "WARNING",
          type: (data.type as AlertTemplateType) || "CUSTOM",
          sentAt: String(data.sentAt ?? new Date().toISOString()),
        });
      },
      [show],
    ),
    { enabled: enabled && Boolean(wsUrl) },
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/alerts/dispatch?limit=1", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { jobs?: AlertDispatchJob[] };
        const latest = data.jobs?.[0];
        if (!latest || cancelled) return;
        const ageMs = Date.now() - new Date(latest.initiatedAt).getTime();
        if (ageMs > 120_000) return;
        if (shownRef.current === latest.jobId) return;
        show(toOverlay(latest));
      } catch {
        /* overlay is best-effort */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, show]);

  if (!enabled || !alert) return null;

  const acknowledge = async () => {
    setAcking(true);
    setAckError(null);
    try {
      const res = await fetch(`/api/alerts/dispatch/${encodeURIComponent(alert.jobId)}/acknowledge`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok && res.status !== 403) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Acknowledge failed");
      }
      markAcked(alert.jobId);
      setAlert(null);
    } catch (e) {
      setAckError(e instanceof Error ? e.message : "Acknowledge failed");
    } finally {
      setAcking(false);
    }
  };

  const tone =
    alert.severity === "CRITICAL"
      ? "bg-red-950/95 border-red-500"
      : alert.severity === "WARNING"
        ? "bg-amber-950/95 border-amber-400"
        : "bg-slate-950/95 border-sky-400";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="vertical-alert-title"
      className={`fixed inset-0 z-[200] flex items-center justify-center p-6 ${tone} border-4`}
    >
      <div className="max-w-2xl text-center text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
          {alert.severity} · {alert.type.replaceAll("_", " ")}
        </p>
        <h2 id="vertical-alert-title" className="mt-3 text-3xl font-bold">
          {alert.title}
        </h2>
        <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-white/90">{alert.body}</p>
        <p className="mt-6 text-sm text-white/70">
          This is not a 911 emergency dispatch system. If you are in immediate danger, hang up and dial
          9-1-1.
        </p>
        <p className="mt-2 text-xs text-white/50">Delivery initiated within 3 seconds to open consoles.</p>
        {ackError ? <p className="mt-3 text-sm text-red-200">{ackError}</p> : null}
        <button
          type="button"
          onClick={() => void acknowledge()}
          disabled={acking}
          className="mt-8 rounded-md bg-white px-6 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          {acking ? "Acknowledging…" : "Acknowledge"}
        </button>
      </div>
    </div>
  );
}
