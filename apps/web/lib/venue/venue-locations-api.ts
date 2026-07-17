import type { QRLocation, QRLocationVertical } from "rapid-cortex-shared";

export async function fetchVenueLocations(
  agencyId: string,
  vertical: QRLocationVertical,
): Promise<QRLocation[]> {
  const res = await fetch(
    `/api/admin/tenants/${encodeURIComponent(agencyId)}/locations?vertical=${vertical}&active=true`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`fetchVenueLocations: ${res.status}`);
  }
  const data = (await res.json()) as { locations?: QRLocation[] };
  return data.locations ?? [];
}
