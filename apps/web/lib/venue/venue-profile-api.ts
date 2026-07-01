import type { VenueProfile } from "rapid-cortex-shared";

export async function fetchVenueProfile(venueCode: string): Promise<VenueProfile | null> {
  const res = await fetch(`/api/venue/code/${encodeURIComponent(venueCode)}/profile`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load venue profile (${res.status})`);
  const data = (await res.json()) as { profile?: VenueProfile };
  return data.profile ?? null;
}

export async function patchVenueProfile(
  venueCode: string,
  patch: Record<string, unknown>,
): Promise<VenueProfile> {
  const res = await fetch(`/api/venue/code/${encodeURIComponent(venueCode)}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { profile?: VenueProfile; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Failed to save venue profile (${res.status})`);
  if (!data.profile) throw new Error("Invalid venue profile response");
  return data.profile;
}
