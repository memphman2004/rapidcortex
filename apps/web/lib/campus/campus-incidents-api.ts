import type { CampusIncident, CampusIncidentStatus } from "./types";

export async function fetchCampusIncidents(
  campusCode: string,
  opts?: { status?: CampusIncidentStatus[]; zoneCode?: string },
): Promise<CampusIncident[]> {
  const params = new URLSearchParams({ campusCode, limit: "50" });
  if (opts?.status?.length) params.set("status", opts.status.join(","));
  const res = await fetch(`/api/campus/incidents?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`);
  const data = (await res.json()) as { incidents?: CampusIncident[] };
  let rows = data.incidents ?? [];
  if (opts?.zoneCode) {
    rows = rows.filter(
      (row) => row.zoneCode === opts.zoneCode || row.roomCode === opts.zoneCode,
    );
  }
  return rows;
}

export async function patchCampusIncident(
  campusCode: string,
  incidentId: string,
  body: { status?: string; assignedTo?: string | null },
): Promise<CampusIncident> {
  const res = await fetch(
    `/api/campus/incidents/${encodeURIComponent(incidentId)}?campusCode=${encodeURIComponent(campusCode)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  const data = (await res.json()) as { incident: CampusIncident };
  return data.incident;
}

export async function escalateCampusIncident(campusCode: string, incidentId: string): Promise<void> {
  const res = await fetch(
    `/api/campus/incidents/${encodeURIComponent(incidentId)}/escalate?campusCode=${encodeURIComponent(campusCode)}`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Escalate failed (${res.status})`);
}
