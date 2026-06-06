const EARTH_RADIUS_M = 6371000;

/**
 * Offset a WGS84 point by approximate meters (small distances only).
 */
export function offsetMeters(lat: number, lon: number, eastM: number, northM: number): [number, number] {
  const dLat = northM / EARTH_RADIUS_M;
  const dLon = eastM / (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180));
  return [lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI];
}
