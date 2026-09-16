"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { VisionSceneAlert, VisionWebSocketEvent } from "rapid-cortex-shared";
import { useAgencyWebSocket, type AgencyWebSocketMessage } from "@/hooks/use-agency-websocket";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { isRapidVisionSceneIntelEnabled, isRapidVisionSceneWsEnabled } from "@/lib/runtime-flags";
import {
  CreateIncidentSlideOver,
  type CreateIncidentResult,
} from "@/components/dispatcher/create-incident-slide-over";

const V = {
  bg: "#09080f",
  surface: "#0f0d1a",
  border: "#1a1630",
  text: "#e4dff5",
  muted: "#6b6190",
  dim: "#3a3460",
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  live: "#22c55e",
} as const;

type FilterTab = "active" | "all" | "dismissed";
type DismissReason = "false_positive" | "already_handled" | "other";

function severityColor(severity: VisionSceneAlert["severity"]): string {
  if (severity === "critical") return V.critical;
  if (severity === "high") return V.high;
  if (severity === "medium") return V.medium;
  return "#9ca3af";
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const age = Date.now() - d.getTime();
  if (age > 60_000) {
    const m = Math.floor(age / 60_000);
    return m >= 60 ? `${Math.floor(m / 60)}h ago` : `${m}m ago`;
  }
  return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function asVisionEvent(message: AgencyWebSocketMessage): VisionWebSocketEvent | null {
  if (!message.type.startsWith("rapid-vision.")) return null;
  return { type: message.type, ...(message.data ?? {}) } as VisionWebSocketEvent;
}

function playAlertTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    void ctx.close();
  } catch {
    /* autoplay / unsupported */
  }
}

async function fetchAlerts(status: FilterTab): Promise<VisionSceneAlert[]> {
  const qs = status === "all" ? "all" : status;
  const res = await fetch(`/api/vision/events?status=${encodeURIComponent(qs)}&limit=50`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: { alerts?: VisionSceneAlert[] } };
  return body.data?.alerts ?? [];
}

async function patchAlert(
  eventId: string,
  action: "dismiss" | "create_incident",
  extras?: { incidentId?: string; dismissReason?: DismissReason },
): Promise<VisionSceneAlert | null> {
  const res = await fetch(`/api/vision/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...extras }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { alert?: VisionSceneAlert } };
  return body.data?.alert ?? null;
}

export function CameraAiAlertsPanel() {
  const jurisdictionSlug = useOptionalJurisdictionSlug();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftAlert, setDraftAlert] = useState<VisionSceneAlert | null>(null);
  const [dismissTarget, setDismissTarget] = useState<VisionSceneAlert | null>(null);
  const [dismissReason, setDismissReason] = useState<DismissReason>("false_positive");
  const [expanded, setExpanded] = useState(false);
  const seenIds = useRef(new Set<string>());

  const enabled = isRapidVisionSceneIntelEnabled();

  const query = useQuery({
    queryKey: ["vision-scene-alerts", tab],
    queryFn: () => fetchAlerts(tab),
    enabled,
    refetchInterval: 15_000,
  });

  const alerts = query.data ?? [];
  const newCount = useMemo(() => alerts.filter((a) => a.status === "active").length, [alerts]);
  const selected = alerts.find((a) => a.eventId === selectedId) ?? alerts[0] ?? null;

  useEffect(() => {
    for (const alert of alerts) {
      if (alert.status !== "active") continue;
      if (seenIds.current.has(alert.eventId)) continue;
      seenIds.current.add(alert.eventId);
      if (seenIds.current.size > alerts.length) playAlertTone();
    }
  }, [alerts]);

  const onWs = useCallback(
    (message: AgencyWebSocketMessage) => {
      const event = asVisionEvent(message);
      if (!event) return;
      if (event.type === "rapid-vision.scene.alert" || event.type === "rapid-vision.scene.updated") {
        void queryClient.invalidateQueries({ queryKey: ["vision-scene-alerts"] });
      }
    },
    [queryClient],
  );

  useAgencyWebSocket(onWs, { enabled: enabled && isRapidVisionSceneWsEnabled() });

  const openCreate = (alert: VisionSceneAlert) => {
    setDraftAlert(alert);
    setDraftOpen(true);
  };

  const handleCreated = async (result: CreateIncidentResult) => {
    if (!draftAlert) return;
    await patchAlert(draftAlert.eventId, "create_incident", { incidentId: result.incidentId });
    setDraftOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["vision-scene-alerts"] });
  };

  const confirmDismiss = async () => {
    if (!dismissTarget) return;
    await patchAlert(dismissTarget.eventId, "dismiss", { dismissReason });
    setDismissTarget(null);
    void queryClient.invalidateQueries({ queryKey: ["vision-scene-alerts"] });
  };

  if (!enabled) {
    return <p className="text-[12px] text-[var(--rc-text-muted)]">Camera AI alerts are not enabled.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: V.bg, color: V.text }}>
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: V.border }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: V.critical }} aria-hidden />
        <span className="text-[11px] font-bold tracking-widest">CAMERA AI ALERTS</span>
        <span className="ml-auto text-[10px] font-semibold tracking-wider" style={{ color: V.live }}>
          LIVE
        </span>
        {newCount > 0 ? (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#7f1d1d", color: "#fecaca" }}>
            {newCount} New
          </span>
        ) : null}
      </div>

      <div className="flex gap-1 border-b px-2 py-1.5" style={{ borderColor: V.border }}>
        {(
          [
            ["active", "Active Alerts"],
            ["all", "All Cameras"],
            ["dismissed", "Dismissed"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: tab === id ? "#1e3a5f" : "transparent",
              color: tab === id ? V.text : V.muted,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.isLoading ? (
          <p className="px-3 py-4 text-[12px]" style={{ color: V.muted }}>
            Loading camera alerts…
          </p>
        ) : alerts.length === 0 ? (
          <p className="px-3 py-4 text-[12px]" style={{ color: V.muted }}>
            No camera AI alerts. The AI surfaces what it sees — nothing is auto-dispatched.
          </p>
        ) : (
          <ul>
            {alerts.map((alert) => (
              <li key={alert.eventId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(alert.eventId);
                    setExpanded(false);
                  }}
                  className="flex w-full items-center gap-2 border-b px-3 py-2 text-left"
                  style={{
                    borderColor: V.border,
                    background: selected?.eventId === alert.eventId ? V.surface : "transparent",
                    boxShadow:
                      alert.status === "active" && alert.severity === "critical"
                        ? `inset 0 0 0 1px ${V.critical}66`
                        : undefined,
                  }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: severityColor(alert.severity) }} />
                  <span className="w-14 shrink-0 font-mono text-[11px]" style={{ color: V.muted }}>
                    {clock(alert.timestamp)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                    {alert.cameraName.replace(/ – .*$/, "")}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: V.muted }}>
                    {alert.shortLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <article className="m-2 rounded-lg border p-3" style={{ borderColor: V.border, background: V.surface }}>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-widest">
              <span className="h-2 w-2 rounded-full" style={{ background: severityColor(selected.severity) }} />
              {selected.severity.toUpperCase()}
              <span className="ml-auto font-mono font-medium" style={{ color: V.muted }}>
                {clock(selected.timestamp)}
              </span>
            </div>
            <p className="text-[13px] font-semibold">{selected.cameraName}</p>
            <p className="mb-2 text-[11px]" style={{ color: V.muted }}>
              Zone: {selected.zoneLabel || "—"}
            </p>
            {selected.narrative ? (
              <p
                className="mb-3 text-[12px] leading-relaxed"
                style={{ color: V.text, display: expanded ? "block" : "-webkit-box", WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                “{selected.narrative}”
              </p>
            ) : (
              <p className="mb-3 text-[12px]" style={{ color: V.muted }}>
                {selected.shortLabel}. Description pending — dispatcher confirms before any dispatch.
              </p>
            )}
            {selected.narrative ? (
              <button type="button" className="mb-3 text-[10px] uppercase tracking-wide" style={{ color: V.dim }} onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : "Expand"}
              </button>
            ) : null}
            {selected.status === "incident_created" && selected.incidentId ? (
              <p className="mb-3 text-[11px]" style={{ color: V.live }}>
                Linked incident {selected.incidentId}
              </p>
            ) : null}
            <p className="mb-3 text-[10px] uppercase tracking-wide" style={{ color: V.dim }}>
              AI surfaces the alert. You make the decision.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <a
                href={
                  jurisdictionSlug
                    ? `/${jurisdictionSlug}/media?vision=1&camera=${encodeURIComponent(selected.cameraId)}`
                    : `?vision=1&camera=${encodeURIComponent(selected.cameraId)}`
                }
                className="rounded border px-2 py-1 text-[11px] font-semibold"
                style={{ borderColor: V.border, color: V.text }}
              >
                Open Feed
              </a>
              <button type="button" onClick={() => openCreate(selected)} className="rounded border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: V.border, color: V.text }}>
                Create Incident
              </button>
              {selected.status === "active" ? (
                <button type="button" onClick={() => setDismissTarget(selected)} className="rounded border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: V.border, color: V.muted }}>
                  Dismiss
                </button>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>

      {dismissTarget ? (
        <div className="border-t px-3 py-2" style={{ borderColor: V.border, background: V.surface }}>
          <p className="mb-2 text-[11px] font-semibold">Dismiss reason</p>
          <select
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value as DismissReason)}
            className="mb-2 w-full rounded border bg-transparent px-2 py-1 text-[12px]"
            style={{ borderColor: V.border, color: V.text }}
          >
            <option value="false_positive">False positive</option>
            <option value="already_handled">Already handled</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={() => void confirmDismiss()} className="rounded border px-2 py-1 text-[11px]" style={{ borderColor: V.border, color: V.text }}>
              Confirm dismiss
            </button>
            <button type="button" onClick={() => setDismissTarget(null)} className="rounded px-2 py-1 text-[11px]" style={{ color: V.muted }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <CreateIncidentSlideOver
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        onCreated={(result) => void handleCreated(result)}
        draft={
          draftAlert
            ? {
                location: draftAlert.cameraName,
                description: draftAlert.narrative || draftAlert.shortLabel,
              }
            : undefined
        }
      />
    </div>
  );
}
