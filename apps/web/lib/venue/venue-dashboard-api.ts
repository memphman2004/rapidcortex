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

export async function fetchVenueStats(agencyId: string): Promise<VenueStatsResponse> {
  return readJson(await fetch(venuePath(agencyId, "/stats"), { cache: "no-store" }));
}

export async function fetchVenueSections(agencyId: string): Promise<VenueSectionSummary[]> {
  return readJson(await fetch(venuePath(agencyId, "/sections"), { cache: "no-store" }));
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
