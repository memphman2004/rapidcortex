/**
 * Distance in miles between two GPS points (Haversine).
 */
export function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateCentroid(coordinates: Array<{ lat: number; lon: number }>): { lat: number; lon: number } {
  if (coordinates.length === 0) {
    throw new Error("Cannot calculate centroid of empty array");
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const coord of coordinates) {
    const lat = (coord.lat * Math.PI) / 180;
    const lon = (coord.lon * Math.PI) / 180;

    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }

  const total = coordinates.length;
  x /= total;
  y /= total;
  z /= total;

  const centralLon = Math.atan2(y, x);
  const centralSquareRoot = Math.sqrt(x * x + y * y);
  const centralLat = Math.atan2(z, centralSquareRoot);

  return {
    lat: (centralLat * 180) / Math.PI,
    lon: (centralLon * 180) / Math.PI,
  };
}

export function getTimeDifferenceMinutes(timestamp1: string, timestamp2: string): number {
  const diff = Math.abs(new Date(timestamp1).getTime() - new Date(timestamp2).getTime());
  return diff / (1000 * 60);
}
