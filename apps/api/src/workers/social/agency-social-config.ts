/**
 * Shared agency config for social ingestion workers.
 * Prefer ACTIVE_AGENCY_IDS + SOCIAL_AGENCY_CONFIGS env (JSON); no cross-tenant Scan.
 */

export type AgencySocialConfig = {
  agencyId: string;
  /** City / neighborhood keywords used when posts lack geo-tags. */
  cityHints: string[];
  /** When false, Bluesky polling skips this agency. Default true. */
  blueskyEnabled?: boolean;
  lat?: number;
  lon?: number;
  /** Jurisdiction radius in km for geo-filtered signals. */
  radiusKm?: number;
};

function parseConfigs(): AgencySocialConfig[] {
  const raw = process.env.SOCIAL_AGENCY_CONFIGS?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is AgencySocialConfig =>
          typeof row === "object" &&
          row !== null &&
          typeof (row as AgencySocialConfig).agencyId === "string" &&
          (row as AgencySocialConfig).agencyId.trim().length > 0,
      )
      .map((row) => ({
        agencyId: row.agencyId.trim(),
        cityHints: Array.isArray(row.cityHints)
          ? row.cityHints.filter((h): h is string => typeof h === "string" && h.trim().length > 0)
          : [],
        blueskyEnabled: row.blueskyEnabled !== false,
        lat: typeof row.lat === "number" ? row.lat : undefined,
        lon: typeof row.lon === "number" ? row.lon : undefined,
        radiusKm: typeof row.radiusKm === "number" ? row.radiusKm : undefined,
      }));
  } catch (err) {
    console.warn("[social] SOCIAL_AGENCY_CONFIGS JSON parse failed", err);
    return [];
  }
}

/** Active agency IDs for social workers (same env as check-in / learning). */
export function resolveActiveAgencyIds(): string[] {
  const fromEnv = (process.env.ACTIVE_AGENCY_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return parseConfigs().map((c) => c.agencyId);
}

export function resolveAgencySocialConfigs(): AgencySocialConfig[] {
  const configs = parseConfigs();
  const byId = new Map(configs.map((c) => [c.agencyId, c]));
  const ids = resolveActiveAgencyIds();
  return ids.map(
    (agencyId) =>
      byId.get(agencyId) ?? {
        agencyId,
        cityHints: [],
        blueskyEnabled: true,
      },
  );
}

/** Haversine distance in km. */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isSocialBlueskyEnabled(): boolean {
  const raw = process.env.SOCIAL_BLUESKY_ENABLED;
  return raw !== "false" && raw !== "0";
}
