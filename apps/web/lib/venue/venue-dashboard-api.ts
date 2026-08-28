import type {
  VenueEventsResponse,
  VenueNotificationBody,
  VenueOnDutyStaff,
  VenueSectionSummary,
  VenueStatsResponse,
} from "rapid-cortex-shared";

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function venuePath(agencyId: string, suffix: string): string {
  return `/api/venue/${encodeURIComponent(agencyId)}${suffix}`;
}

function asRecord(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return row as Record<string, unknown>;
}

function toSectionSummary(row: unknown): VenueSectionSummary | null {
  const r = asRecord(row);
  if (!r) return null;
  const sectionId = String(r.sectionId ?? r.id ?? "").trim();
  const sectionName = String(r.sectionName ?? r.label ?? "").trim();
  if (!sectionId) return null;
  return {
    sectionId,
    sectionName: sectionName || sectionId,
    gate: String(r.gate ?? r.zone ?? "Main"),
    level: String(r.level ?? ""),
    capacity: Number(r.capacity ?? 0) || 0,
    incidentCount: Number(r.incidentCount ?? 0) || 0,
    status: String(r.status ?? ""),
  };
}

/** Accept dashboard `VenueSectionSummary[]` or CRUD `{ sections: VenueSection[] }`. */
export function normalizeVenueSectionSummaries(payload: unknown): VenueSectionSummary[] {
  if (Array.isArray(payload)) {
    return payload.map(toSectionSummary).filter((row): row is VenueSectionSummary => row !== null);
  }
  const wrapped = asRecord(payload)?.sections;
  if (Array.isArray(wrapped)) {
    return wrapped.map(toSectionSummary).filter((row): row is VenueSectionSummary => row !== null);
  }
  return [];
}

export async function fetchVenueStats(agencyId: string): Promise<VenueStatsResponse> {
  return readJson(await fetch(venuePath(agencyId, "/stats"), { cache: "no-store" }));
}

export async function fetchVenueSections(agencyId: string): Promise<VenueSectionSummary[]> {
  return normalizeVenueSectionSummaries(
    await readJson(await fetch(venuePath(agencyId, "/sections"), { cache: "no-store" })),
  );
}

export async function fetchVenueEvents(agencyId: string): Promise<VenueEventsResponse> {
  return readJson(await fetch(venuePath(agencyId, "/events"), { cache: "no-store" }));
}

export async function fetchVenueOnDuty(agencyId: string): Promise<VenueOnDutyStaff[]> {
  return readJson(await fetch(venuePath(agencyId, "/staff/on-duty"), { cache: "no-store" }));
}

export async function postVenueNotification(
  agencyId: string,
  body: VenueNotificationBody,
): Promise<{ notification: { notificationId: string } }> {
  return readJson(
    await fetch(venuePath(agencyId, "/notifications"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
