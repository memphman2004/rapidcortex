export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CircleGeofence {
  center: GeoPoint;
  /** Radius in meters */
  radiusMeters: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two WGS84 coordinates (haversine formula).
 * Returns distance in meters.
 */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);

  const haversine =
    sinDeltaLat * sinDeltaLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_METERS * centralAngle;
}

/**
 * Returns true when `point` lies inside a circular geofence (inclusive of boundary).
 */
export function isPointInCircleGeofence(point: GeoPoint, geofence: CircleGeofence): boolean {
  const distance = haversineDistanceMeters(point, geofence.center);
  return distance <= geofence.radiusMeters;
}

/**
 * Returns the signed distance from a point to the geofence boundary.
 * Negative values mean inside the circle; positive values mean outside.
 */
export function distanceToCircleBoundaryMeters(point: GeoPoint, geofence: CircleGeofence): number {
  const distanceFromCenter = haversineDistanceMeters(point, geofence.center);
  return distanceFromCenter - geofence.radiusMeters;
}

/**
 * Bearing in degrees (0–360) from point A to point B.
 */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Returns a new point offset from `origin` by `distanceMeters` along `bearingDeg`.
 */
export function offsetPoint(
  origin: GeoPoint,
  distanceMeters: number,
  bearingDeg: number,
): GeoPoint {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}
