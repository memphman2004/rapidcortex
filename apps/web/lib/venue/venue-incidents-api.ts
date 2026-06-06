import type { IncidentStatus, IncidentType, VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";

export async function fetchVenueIncidents(
  venueCode: string,
  opts?: { status?: IncidentStatus[]; type?: IncidentType[] },
): Promise<VenueIncident[]> {
  const params = new URLSearchParams({ venueCode, limit: "50" });
  if (opts?.status?.length) params.set("status", opts.status.join(","));
  if (opts?.type?.length) params.set("type", opts.type.join(","));
  const res = await fetch(`/api/venue/incidents?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load venue incidents (${res.status})`);
  const data = (await res.json()) as { incidents?: VenueIncident[] };
  return data.incidents ?? [];
}
