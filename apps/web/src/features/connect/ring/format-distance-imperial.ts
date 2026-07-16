/** Display helpers for US operational UI. API/geo math stays in meters. */

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.280839895;

/**
 * Format a search-radius or distance value for dispatcher UI.
 * Uses feet under ~0.2 mi; miles otherwise.
 */
export function formatDistanceImperial(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";

  const miles = meters / METERS_PER_MILE;
  if (miles < 0.2) {
    const feet = Math.round(meters * FEET_PER_METER);
    // Nearest 10 ft keeps chip labels clean (100m → 330 ft)
    const rounded = Math.max(1, Math.round(feet / 10) * 10);
    return `${rounded} ft`;
  }

  const roundedMiles = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles);
  const label = Number.isInteger(roundedMiles) ? String(roundedMiles) : roundedMiles.toFixed(1);
  return `${label} mi`;
}
