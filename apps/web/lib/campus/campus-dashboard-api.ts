import type {
  CampusBuildingSummary,
  CampusNotificationBody,
  CampusOnDutyStaff,
  CampusStatsResponse,
  CampusThreatLevel,
  CampusThreatLevelState,
  CampusZoneSummary,
} from "rapid-cortex-shared";
import type { CampusBroadcastBody } from "rapid-cortex-shared";
import type { CampusIncident } from "./types";

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function campusPath(agencyId: string, suffix: string): string {
  return `/api/campus/${encodeURIComponent(agencyId)}${suffix}`;
}

export async function fetchCampusStats(agencyId: string): Promise<CampusStatsResponse> {
  return readJson(await fetch(campusPath(agencyId, "/stats"), { cache: "no-store" }));
}

export async function fetchCampusZones(agencyId: string): Promise<CampusZoneSummary[]> {
  return readJson(await fetch(campusPath(agencyId, "/zones"), { cache: "no-store" }));
}

export async function fetchCampusBuildings(agencyId: string): Promise<CampusBuildingSummary[]> {
  return readJson(await fetch(campusPath(agencyId, "/buildings"), { cache: "no-store" }));
}

export async function fetchCampusThreatLevel(agencyId: string): Promise<CampusThreatLevelState> {
  return readJson(await fetch(campusPath(agencyId, "/threat-level"), { cache: "no-store" }));
}

export async function patchCampusThreatLevel(
  agencyId: string,
  level: CampusThreatLevel,
): Promise<CampusThreatLevelState> {
  return readJson(
    await fetch(campusPath(agencyId, "/threat-level"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level }),
    }),
  );
}

export async function fetchCampusOnDuty(agencyId: string): Promise<CampusOnDutyStaff[]> {
  return readJson(await fetch(campusPath(agencyId, "/staff/on-duty"), { cache: "no-store" }));
}

export async function postCampusNotification(
  agencyId: string,
  body: CampusNotificationBody,
): Promise<{ notification: { notificationId: string } }> {
  return readJson(
    await fetch(campusPath(agencyId, "/notifications"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function postCampusBroadcast(
  agencyId: string,
  body: CampusBroadcastBody,
): Promise<{ broadcast: { broadcastId: string; cooldownSeconds?: number } }> {
  const res = await fetch(campusPath(agencyId, "/broadcast"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    broadcast?: { broadcastId: string; cooldownSeconds?: number };
    error?: string;
    cooldownSeconds?: number;
  };
  if (!res.ok) {
    const err = new Error(json.error ?? `Broadcast failed (${res.status})`) as Error & {
      cooldownSeconds?: number;
    };
    err.cooldownSeconds = json.cooldownSeconds ?? json.broadcast?.cooldownSeconds;
    throw err;
  }
  return json as { broadcast: { broadcastId: string; cooldownSeconds?: number } };
}

export async function fetchCampusOpenIncidents(
  campusCode: string,
  limit = 20,
): Promise<CampusIncident[]> {
  const params = new URLSearchParams({
    campusCode,
    status: "open,assigned,responding",
    limit: String(limit),
  });
  const res = await fetch(`/api/campus/incidents?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`);
  const data = (await res.json()) as { incidents?: CampusIncident[] };
  return data.incidents ?? [];
}
