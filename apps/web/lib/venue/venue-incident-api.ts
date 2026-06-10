import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";

export async function fetchVenueIncident(
  venueCode: string,
  incidentId: string,
): Promise<VenueIncident | null> {
  const params = new URLSearchParams({ venueCode: venueCode.toUpperCase() });
  const res = await fetch(
    `/api/venue/incidents/${encodeURIComponent(incidentId)}?${params}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load venue incident (${res.status})`);
  const data = (await res.json()) as { incident?: VenueIncident };
  return data.incident ?? null;
}
