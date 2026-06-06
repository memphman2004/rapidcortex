export function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

/** Approximate meters → lon/lat ring (adequate for sub-km GPS accuracy rings). */
export function createAccuracyCirclePolygon(lat: number, lon: number, radiusMeters: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const points = 64;
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;

  for (let i = 0; i < points; i++) {
    const angle = (i * 360) / points;
    const dx = km * Math.cos((angle * Math.PI) / 180);
    const dy = km * Math.sin((angle * Math.PI) / 180);

    const newLon =
      lon + (dx / Math.cos((lat * Math.PI) / 180)) * (180 / (Math.PI * 6371));
    const newLat = lat + (dy * 180) / (Math.PI * 6371);

    coords.push([newLon, newLat]);
  }

  coords.push(coords[0]);

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

export function lineStringFeature(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}
