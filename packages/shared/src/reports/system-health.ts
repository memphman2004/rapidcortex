/**
 * Monthly system health report — device uptime, activations, resolved incidents, open issues.
 */

export const SYSTEM_HEALTH_ACTIVATION_TYPES = [
  "qr_nfc.code.created",
  "qr_code.created",
  "mobile_code.created",
  "public.report.submitted",
  "live_video.activated",
  "safe_sound.device.registered",
  "hospital.mci.plan_activated",
] as const;

export type SystemHealthActivationType = (typeof SYSTEM_HEALTH_ACTIVATION_TYPES)[number];

const ACTIVATION_SET = new Set<string>(SYSTEM_HEALTH_ACTIVATION_TYPES);

export const DEVICE_STALE_MS = 15 * 60_000;

export type SystemHealthDeviceInput = {
  id: string;
  label: string;
  lastHeartbeat?: string | null;
  status?: string | null;
};

export type SystemHealthIncidentInput = {
  incidentId: string;
  status: string;
  category?: string;
  createdAt: string;
  urgency?: string;
};

export type SystemHealthAuditInput = {
  type: string;
  createdAt: string;
  actorId?: string;
  resourceId?: string;
};

export type SystemHealthReportInput = {
  incidentsCreatedInRange: SystemHealthIncidentInput[];
  openIncidents: SystemHealthIncidentInput[];
  auditEvents: SystemHealthAuditInput[];
  devices: SystemHealthDeviceInput[];
  nowMs?: number;
  periodStart: string;
  periodEnd: string;
};

export function isSystemHealthActivationType(type: string): type is SystemHealthActivationType {
  return ACTIVATION_SET.has(type);
}

export function isOpenIncidentStatus(status: string): boolean {
  return status === "active" || status === "in_progress";
}

export function isResolvedIncidentStatus(status: string): boolean {
  return status === "completed" || status === "archived";
}

/** Inclusive UTC calendar month containing `now`. */
export function calendarMonthRangeUtc(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Previous complete UTC calendar month. */
export function previousCalendarMonthRangeUtc(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function calendarMonthLabelUtc(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return "Unknown period";
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function classifyDeviceFreshness(
  device: SystemHealthDeviceInput,
  nowMs: number,
  staleMs = DEVICE_STALE_MS,
): "online" | "stale" | "offline" {
  if (device.status === "offline") return "offline";
  const hb = device.lastHeartbeat ? Date.parse(device.lastHeartbeat) : NaN;
  if (!Number.isFinite(hb)) {
    return device.status === "online" ? "stale" : "offline";
  }
  const age = nowMs - hb;
  if (age <= staleMs) return "online";
  if (age <= staleMs * 4) return "stale";
  return "offline";
}

export function buildSystemHealthReport(input: SystemHealthReportInput): {
  rows: Record<string, unknown>[];
  summary: Record<string, number>;
} {
  const nowMs = input.nowMs ?? Date.now();
  const resolved = input.incidentsCreatedInRange.filter((i) => isResolvedIncidentStatus(i.status));
  const open = input.openIncidents.filter((i) => isOpenIncidentStatus(i.status));
  const activations = input.auditEvents.filter((e) => isSystemHealthActivationType(e.type));

  const freshness = input.devices.map((d) => classifyDeviceFreshness(d, nowMs));
  const online = freshness.filter((f) => f === "online").length;
  const stale = freshness.filter((f) => f === "stale").length;
  const offline = freshness.filter((f) => f === "offline").length;
  const totalDevices = input.devices.length;
  const uptimePercent = totalDevices > 0 ? Math.round((online / totalDevices) * 1000) / 10 : 0;

  const summary: Record<string, number> = {
    uptimePercent,
    devicesOnline: online,
    devicesStale: stale,
    devicesOffline: offline,
    devicesTotal: totalDevices,
    activations: activations.length,
    resolvedIncidents: resolved.length,
    openIssues: open.length,
    incidentsOpened: input.incidentsCreatedInRange.length,
  };

  const rows: Record<string, unknown>[] = [
    {
      section: "summary",
      metric: "Device uptime %",
      value: uptimePercent,
      detail: totalDevices === 0 ? "No registered cameras/devices for this agency" : `${online} of ${totalDevices} online`,
    },
    {
      section: "summary",
      metric: "Activation events",
      value: activations.length,
      detail: "QR/NFC, public reports, live video, device registrations",
    },
    {
      section: "summary",
      metric: "Resolved incidents",
      value: resolved.length,
      detail: "Completed or archived, opened in this period",
    },
    {
      section: "summary",
      metric: "Open issues",
      value: open.length,
      detail: "Currently active or in progress",
    },
  ];

  for (let i = 0; i < input.devices.length; i++) {
    const device = input.devices[i]!;
    rows.push({
      section: "device",
      deviceId: device.id,
      label: device.label,
      status: freshness[i],
      lastHeartbeat: device.lastHeartbeat ?? "",
    });
  }

  for (const event of activations) {
    rows.push({
      section: "activation",
      type: event.type,
      createdAt: event.createdAt,
      actorId: event.actorId ?? "",
      resourceId: event.resourceId ?? "",
    });
  }

  for (const incident of resolved) {
    rows.push({
      section: "resolved",
      incidentId: incident.incidentId,
      status: incident.status,
      category: incident.category ?? "",
      createdAt: incident.createdAt,
    });
  }

  for (const incident of open) {
    rows.push({
      section: "open",
      incidentId: incident.incidentId,
      status: incident.status,
      category: incident.category ?? "",
      urgency: incident.urgency ?? "",
      createdAt: incident.createdAt,
    });
  }

  return { rows, summary };
}
