"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { VisionSceneAlert } from "rapid-cortex-shared";
import { RapidVisionPanel } from "@/components/rapid-vision/RapidVisionPanel";
import { SceneIncidentDesk } from "@/components/rapid-vision/SceneIncidentDesk";
import { SceneMonitoringProfiles } from "@/components/rapid-vision/SceneMonitoringProfiles";
import { acknowledgeIqVisionEvent, signalIqVisionNavAlert } from "@/lib/rapid-vision/iq-vision-nav-alert-store";
import {
  acknowledgeSceneAlert,
  isSceneAlertAcknowledged,
  listSyntheticSceneAlerts,
  markSceneAlertViewed,
  simulateCriticalSceneAlert,
  subscribeSceneReview,
  type SyntheticSceneAlert,
} from "@/lib/rapid-vision/scene-review-store";

type RegistryCamera = {
  cameraId: string;
  friendlyName?: string;
  zoneLabel?: string;
  connectionStatus?: string;
  aiMonitoringEnabled?: boolean;
  lastHealthCheck?: string | null;
};

export type VisionSection =
  | "command"
  | "scene"
  | "cameras"
  | "alerts"
  | "incident"
  | "analytics"
  | "settings";

const SECTIONS: Array<{ id: VisionSection; label: string }> = [
  { id: "command", label: "Command Center" },
  { id: "scene", label: "Scene Intelligence" },
  { id: "cameras", label: "Cameras" },
  { id: "alerts", label: "Active Alerts" },
  { id: "incident", label: "Incident Vision" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

type AlertRow = {
  eventId: string;
  cameraName: string;
  zoneLabel: string;
  severity: string;
  status: string;
  shortLabel: string;
  narrative: string;
  timestamp: string;
  incidentId?: string;
  synthetic: boolean;
};

function isTestAlert(eventId: string, synthetic: boolean): boolean {
  return synthetic || eventId.startsWith("scene-demo-") || eventId.startsWith("scene-test-");
}

function fromApi(alert: VisionSceneAlert): AlertRow {
  return {
    eventId: alert.eventId,
    cameraName: alert.cameraName,
    zoneLabel: alert.zoneLabel,
    severity: alert.severity,
    status: alert.status,
    shortLabel: alert.shortLabel,
    narrative: alert.narrative,
    timestamp: alert.timestamp,
    incidentId: alert.incidentId,
    synthetic: isTestAlert(alert.eventId, false),
  };
}

function fromSynthetic(alert: SyntheticSceneAlert): AlertRow {
  return {
    eventId: alert.eventId,
    cameraName: alert.cameraName,
    zoneLabel: alert.zoneLabel,
    severity: alert.severity,
    status: alert.review === "acknowledged" ? "acknowledged" : "active",
    shortLabel: alert.shortLabel,
    narrative: alert.narrative,
    timestamp: alert.timestamp,
    synthetic: true,
  };
}

async function readJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function VisionCommandCenter({
  section,
  onSection,
  focusAlertId,
  agencyName,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  canVerify,
  reviewQueue = false,
}: {
  section: VisionSection;
  onSection: (section: VisionSection) => void;
  focusAlertId: string | null;
  agencyName: string;
  incidents: Array<{
    incidentId: string;
    title: string;
    callerLocationLat?: number | null;
    callerLocationLng?: number | null;
  }>;
  selectedIncidentId: string | null;
  onSelectIncident: (incidentId: string | null) => void;
  canVerify: boolean;
  /** Supervisor, watch desk, or security operations. Call-takers stay quiet. */
  reviewQueue?: boolean;
}) {
  const queryClient = useQueryClient();
  const [reviewTick, setReviewTick] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => subscribeSceneReview(() => setReviewTick((n) => n + 1)), []);

  const eventsQuery = useQuery({
    queryKey: ["vision-scene-events"],
    queryFn: () =>
      readJson<{ data?: { alerts?: VisionSceneAlert[] } }>("/api/vision/events?status=all&limit=50"),
  });
  const camerasQuery = useQuery({
    queryKey: ["vision-cameras"],
    queryFn: () => readJson<{ data?: { cameras?: RegistryCamera[] } }>("/api/vision/cameras"),
  });

  const cameras = camerasQuery.data?.data?.cameras ?? [];
  const apiAlerts = eventsQuery.data?.data?.alerts ?? [];
  const alerts = useMemo(() => {
    const synthetic = listSyntheticSceneAlerts().map(fromSynthetic);
    const remote = apiAlerts.map(fromApi);
    const seen = new Set(synthetic.map((row) => row.eventId));
    return [...synthetic, ...remote.filter((row) => !seen.has(row.eventId))];
  }, [apiAlerts, reviewTick]);

  const openCritical = alerts.filter(
    (alert) =>
      alert.severity === "critical" &&
      alert.status === "active" &&
      !isSceneAlertAcknowledged(alert.eventId),
  );

  const online = cameras.filter((camera) => isCameraOnline(camera.connectionStatus)).length;
  const offline = cameras.filter((camera) => isCameraOffline(camera.connectionStatus)).length;
  const monitoring = cameras.filter((camera) => camera.aiMonitoringEnabled === true).length;
  const monitoringHealth = cameraHealthLabel({
    loaded: camerasQuery.isSuccess,
    failed: camerasQuery.isError || eventsQuery.isError,
    cameraCount: cameras.length,
    online,
    monitoring,
    offline,
  });

  const selected = alerts.find((alert) => alert.eventId === focusAlertId) ?? openCritical[0] ?? alerts[0] ?? null;

  useEffect(() => {
    if (section === "alerts" && selected) markSceneAlertViewed(selected.eventId);
  }, [section, selected]);

  async function dismiss(alert: AlertRow, reason: "false_positive" | "already_handled" | "other") {
    setActionError(null);
    acknowledgeSceneAlert(alert.eventId);
    acknowledgeIqVisionEvent(alert.eventId);
    if (alert.synthetic) return;
    const res = await fetch(`/api/vision/events/${encodeURIComponent(alert.eventId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "dismiss", dismissReason: reason }),
    });
    if (!res.ok) setActionError("The alert was acknowledged on this screen. The server did not record the dismissal.");
    else void queryClient.invalidateQueries({ queryKey: ["vision-scene-events"] });
  }

  async function linkIncident(alert: AlertRow) {
    if (!selectedIncidentId || alert.synthetic) {
      setActionError("Choose an existing incident in Incident Vision. This does not create a CAD record.");
      return;
    }
    setActionError(null);
    const res = await fetch(`/api/vision/events/${encodeURIComponent(alert.eventId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create_incident", incidentId: selectedIncidentId }),
    });
    if (!res.ok) setActionError("The incident link was not saved.");
    else void queryClient.invalidateQueries({ queryKey: ["vision-scene-events"] });
  }

  function acknowledge(alert: AlertRow) {
    acknowledgeSceneAlert(alert.eventId);
    acknowledgeIqVisionEvent(alert.eventId);
  }

  function runTest() {
    const alert = simulateCriticalSceneAlert();
    if (reviewQueue) signalIqVisionNavAlert({ eventId: alert.eventId });
    onSection("alerts");
  }

  const selectedIncident = incidents.find((incident) => incident.incidentId === selectedIncidentId) ?? null;

  return (
    <div className="flex h-full flex-col gap-4 text-slate-100">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300">iQ VISION™</p>
        <h1 className="mt-1 text-xl font-semibold text-white">Real-time visual intelligence</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Incident awareness and camera monitoring for {agencyName}. A machine observation stays unverified until a person reviews it. iQ Vision does not dispatch responders or create CAD incidents.
        </p>
        {reviewQueue ? (
          <p className="mt-2 max-w-3xl text-sm text-amber-100">
            Unassociated camera alerts stay on this watch desk. The red sidebar pulse continues until you acknowledge the alert. Opening this page does not acknowledge it, and it does not appear on a call-taker&apos;s active 911 call.
          </p>
        ) : (
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Camera alerts for this agency are routed to the supervisor watch desk. They do not pulse or pop up on this call-taker console.
          </p>
        )}
        <dl className="mt-3 flex flex-wrap gap-2 text-xs">
          <StatusChip label="Agency" value={agencyName} />
          <StatusChip label="Critical alerts" value={openCritical.length ? String(openCritical.length) : "None raised"} tone={openCritical.length ? "red" : "slate"} />
          <StatusChip label="Cameras needing attention" value={String(offline)} tone={offline ? "amber" : "slate"} />
          <StatusChip label="Monitoring health" value={monitoringHealth} tone={monitoringHealth === "Reporting" ? "slate" : "amber"} />
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          No alert raised does not mean the scene is safe. Offline cameras, disabled monitoring, and unavailable analysis are reported separately.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-slate-800" aria-label="iQ Vision sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSection(item.id)}
            className={`border-b-2 px-3 py-2 text-sm ${
              section === item.id ? "border-cyan-400 font-semibold text-cyan-200" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {item.label}
            {item.id === "alerts" && openCritical.length > 0 ? (
              <span className="ml-2 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{openCritical.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {section === "command" || section === "alerts" || section === "scene" ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Total cameras" value={cameras.length} />
              <Metric label="Online cameras" value={online} />
              <Metric label="Monitoring" value={monitoring} />
              <Metric label="Offline cameras" value={Math.max(0, cameras.length - online)} />
              <Metric label="Active alerts" value={alerts.filter((a) => a.status === "active").length} />
              <Metric label="Critical alerts" value={openCritical.length} />
              <Metric label="Active incidents" value={incidents.length} />
              <Metric label="Monitoring health" value={monitoringHealth} />
            </div>
            {section !== "alerts" ? <CameraGrid cameras={cameras} loading={camerasQuery.isLoading} /> : null}
            {section === "scene" ? <ScenePolicy /> : null}
          </div>
          <AlertQueue
            alerts={section === "alerts" ? alerts : openCritical}
            selectedId={selected?.eventId ?? null}
            onAcknowledge={acknowledge}
            onDismiss={dismiss}
            onLink={linkIncident}
            error={actionError}
          />
        </section>
      ) : null}

      {section === "cameras" ? <CameraGrid cameras={cameras} loading={camerasQuery.isLoading} detailed /> : null}

      {section === "incident" ? (
        <div className="space-y-3">
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-300">
            Incident
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
              value={selectedIncidentId ?? ""}
              onChange={(event) => onSelectIncident(event.target.value || null)}
            >
              <option value="">No incident selected</option>
              {incidents.map((incident) => (
                <option key={incident.incidentId} value={incident.incidentId}>
                  {incident.incidentId} · {incident.title}
                </option>
              ))}
            </select>
          </label>
          {selectedIncidentId && selectedIncident ? (
            <div className="min-h-[520px]">
              <RapidVisionPanel
                incidentId={selectedIncidentId}
                incidentLat={selectedIncident.callerLocationLat ?? 0}
                incidentLng={selectedIncident.callerLocationLng ?? 0}
                canVerify={canVerify}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-400">
              No authorized cameras are shown until you select an incident. Incident Vision does not search private residential cameras.
            </p>
          )}
        </div>
      ) : null}

      {section === "analytics" ? <Analytics alerts={alerts} cameras={cameras.length} /> : null}

      {section === "settings" ? (
        <div className="space-y-4">
          <SceneMonitoringProfiles />
          <SceneIncidentDesk />
          <div className="max-w-2xl space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
            <p>Detection models are not validated for live public-safety decisions. Categories stay off until an agency enables a reviewed source.</p>
            <p>Ring and Google Nest are not connected. Wyze stays disabled. A camera is never shown as live unless a stream is actually connected.</p>
            <button type="button" onClick={runTest} className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600">
              Simulate critical scene alert
            </button>
            <p className="text-xs text-slate-500">The simulation is labeled TEST. On the watch desk it pulses the sidebar. It does not pop up on a call-taker&apos;s active 911 call, and it does not create an incident or a CAD record.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusChip({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "red" | "green" | "amber" }) {
  const toneClass =
    tone === "red" ? "text-red-200" : tone === "green" ? "text-emerald-200" : tone === "amber" ? "text-amber-200" : "text-slate-200";
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`font-medium ${toneClass}`}>{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1220] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function CameraGrid({ cameras, loading, detailed = false }: { cameras: RegistryCamera[]; loading: boolean; detailed?: boolean }) {
  if (loading) return <p className="text-sm text-slate-400">Loading the camera registry…</p>;
  if (cameras.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-8 text-sm text-slate-400">
        No authorized cameras are registered for this agency. iQ Vision does not discover private cameras near an incident.
      </p>
    );
  }
  return (
    <ul className={`grid gap-2 ${detailed ? "md:grid-cols-2" : "sm:grid-cols-2"}`}>
      {cameras.slice(0, detailed ? cameras.length : 8).map((camera) => {
        const status = cameraTileState(camera);
        return (
          <li key={camera.cameraId} className="rounded-lg border border-slate-800 bg-[#0c1220] p-3">
            <p className="text-sm font-medium text-white">{camera.friendlyName || camera.cameraId}</p>
            <p className="text-xs text-slate-400">{camera.zoneLabel || "No zone assigned"}</p>
            <p className={`mt-2 text-xs ${status.tone}`}>{status.label}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              No live picture is shown here. A still image is not treated as a live feed.
              {camera.lastHealthCheck ? ` Last check ${camera.lastHealthCheck}` : " No heartbeat recorded."}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function ScenePolicy() {
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      <p>An alert reaches a person only after these checks. A quiet queue is not an all-clear.</p>
      <ol className="list-decimal space-y-1 pl-4 text-amber-50/90">
        <li>Monitoring runs only on an enabled camera with a defined safety purpose.</li>
        <li>A lightweight signal or an approved VMS event marks a possible event. One frame is not an alert.</li>
        <li>The event is checked across time, place, hours, and any corroborating signal.</li>
        <li>Repeats from the same camera are grouped. One event does not become dozens of notifications.</li>
        <li>A qualified alert goes to the supervisor watch desk. The call-taker&apos;s active 911 call is not interrupted.</li>
      </ol>
      <p>No detection category is activated for live operations until that category has been validated for the deployment.</p>
    </div>
  );
}

function cameraTileState(camera: RegistryCamera): { label: string; tone: string } {
  if (camera.aiMonitoringEnabled !== true) {
    return { label: "Monitoring disabled — this camera can be viewed when a stream exists. Scene Intelligence is off.", tone: "text-slate-300" };
  }
  if (isCameraOffline(camera.connectionStatus)) {
    return { label: "Camera offline — not the same as no alert.", tone: "text-amber-200" };
  }
  if (!isCameraOnline(camera.connectionStatus)) {
    return { label: "Analysis unavailable — connection status was not reported.", tone: "text-amber-200" };
  }
  return { label: "Online · monitoring enabled · no live picture attached", tone: "text-cyan-200" };
}

function isCameraOnline(status: string | undefined): boolean {
  return ["online", "connected", "live"].includes(String(status ?? "").toLowerCase());
}

function isCameraOffline(status: string | undefined): boolean {
  return ["offline", "disconnected", "unavailable", "error"].includes(String(status ?? "").toLowerCase());
}

function cameraHealthLabel(input: {
  loaded: boolean;
  failed: boolean;
  cameraCount: number;
  online: number;
  monitoring: number;
  offline: number;
}): string {
  if (input.failed) return "Analysis unavailable";
  if (!input.loaded) return "Checking";
  if (input.cameraCount === 0 || input.monitoring === 0) return "Monitoring disabled";
  if (input.online === 0 || input.offline === input.cameraCount) return "Camera offline";
  return "Reporting";
}

type GroupedAlert = AlertRow & { repeatCount: number };

function groupRepeatedAlerts(alerts: AlertRow[]): GroupedAlert[] {
  const groups = new Map<string, GroupedAlert>();
  for (const alert of alerts) {
    const key = `${alert.cameraName}|${alert.shortLabel}|${alert.severity}`;
    const existing = groups.get(key);
    if (!existing) groups.set(key, { ...alert, repeatCount: 1 });
    else existing.repeatCount += 1;
  }
  return [...groups.values()];
}

function AlertQueue({
  alerts,
  selectedId,
  onAcknowledge,
  onDismiss,
  onLink,
  error,
}: {
  alerts: AlertRow[];
  selectedId: string | null;
  onAcknowledge: (alert: AlertRow) => void;
  onDismiss: (alert: AlertRow, reason: "false_positive" | "already_handled" | "other") => void;
  onLink: (alert: AlertRow) => void;
  error: string | null;
}) {
  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <h2 className="text-sm font-semibold text-white">Scene Intelligence alerts</h2>
      <p className="mt-1 text-xs text-slate-500">Unverified machine observations. Human review required.</p>
      {error ? <p className="mt-2 text-xs text-amber-200">{error}</p> : null}
      {alerts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No alert has been raised. That is not an all-clear. Check camera offline, monitoring disabled, and analysis unavailable before treating the scene as quiet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {groupRepeatedAlerts(alerts).map((alert) => (
            <li
              key={alert.eventId}
              className={`rounded-md border p-3 ${
                alert.eventId === selectedId ? "border-red-500/70 bg-red-950/30" : "border-slate-800"
              }`}
            >
              {isTestAlert(alert.eventId, alert.synthetic) ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Test — not a live emergency</p>
              ) : null}
              <p className="text-sm font-medium text-white">
                {alert.shortLabel}
                {alert.repeatCount > 1 ? ` · ${alert.repeatCount} grouped` : ""}
              </p>
              <p className="text-xs text-slate-400">
                {alert.cameraName} · {alert.zoneLabel}
              </p>
              <p className="mt-1 text-xs text-slate-300">{alert.narrative}</p>
              <p className="mt-1 text-[11px] text-slate-500">{alert.timestamp}</p>
              {alert.status === "active" && !isSceneAlertAcknowledged(alert.eventId) ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => onAcknowledge(alert)}>
                    Acknowledge
                  </button>
                  <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => onDismiss(alert, "false_positive")}>
                    Possible false positive
                  </button>
                  <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => onLink(alert)}>
                    Link to selected incident
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-emerald-300">Acknowledged on this screen. The alert remains in history.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Analytics({ alerts, cameras }: { alerts: AlertRow[]; cameras: number }) {
  const critical = alerts.filter((alert) => alert.severity === "critical").length;
  const tests = alerts.filter((alert) => isTestAlert(alert.eventId, alert.synthetic)).length;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Metric label="Stored alerts" value={alerts.length} />
      <Metric label="Critical records" value={critical} />
      <Metric label="Labeled test alerts" value={tests} />
      <Metric label="Registered cameras" value={cameras} />
      <p className="sm:col-span-3 text-xs text-slate-500">
        These counts are the records loaded for this agency. They are not a measure of detection accuracy, and they do not include a missed-event rate.
      </p>
    </div>
  );
}
