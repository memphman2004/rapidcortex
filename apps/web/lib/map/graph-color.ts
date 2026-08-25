import type { RegionColorIndex } from "./region-colors";

/**
 * Greedy graph coloring — assigns a color index (0–3) to each node
 * such that no two adjacent nodes share the same color.
 */
export function greedyColor(
  adjacency: Map<string, Set<string>>,
): Map<string, RegionColorIndex> {
  const result = new Map<string, RegionColorIndex>();
  const MAX_COLORS = 4;

  // Higher-degree nodes first — keeps US state graphs within 4 colors.
  const nodes = [...adjacency.keys()].sort((a, b) => {
    const da = adjacency.get(a)?.size ?? 0;
    const db = adjacency.get(b)?.size ?? 0;
    return db - da || a.localeCompare(b);
  });

  for (const node of nodes) {
    const neighbors = adjacency.get(node) ?? new Set<string>();
    const usedColors = new Set<number>();
    for (const neighbor of neighbors) {
      const c = result.get(neighbor);
      if (c !== undefined) usedColors.add(c);
    }

    let assigned = 0;
    while (usedColors.has(assigned) && assigned < MAX_COLORS) {
      assigned += 1;
    }
    result.set(node, (assigned % MAX_COLORS) as RegionColorIndex);
  }

  return result;
}

/**
 * Build an adjacency map from GeoJSON features.
 * Two polygons are adjacent when they share a coordinate (rounded to ~11m).
 */
export function buildAdjacencyFromGeoJSON(
  features: GeoJSON.Feature[],
  idProp: string = "STUSPS",
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const f of features) {
    const id = String(f.properties?.[idProp] ?? f.id ?? "");
    if (id) adjacency.set(id, new Set());
  }

  function getCoords(geom: GeoJSON.Geometry): [number, number][] {
    if (geom.type === "Polygon") {
      return geom.coordinates.flat() as [number, number][];
    }
    if (geom.type === "MultiPolygon") {
      return geom.coordinates.flat(2) as [number, number][];
    }
    return [];
  }

  function roundCoord(c: [number, number]): string {
    return `${c[0].toFixed(4)},${c[1].toFixed(4)}`;
  }

  const coordToIds = new Map<string, Set<string>>();
  for (const f of features) {
    const id = String(f.properties?.[idProp] ?? f.id ?? "");
    if (!id || !f.geometry) continue;
    const coords = getCoords(f.geometry);
    for (const coord of coords) {
      const key = roundCoord(coord);
      if (!coordToIds.has(key)) coordToIds.set(key, new Set());
      coordToIds.get(key)!.add(id);
    }
  }

  for (const ids of coordToIds.values()) {
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]!;
        const b = arr[j]!;
        if (a !== b) {
          adjacency.get(a)?.add(b);
          adjacency.get(b)?.add(a);
        }
      }
    }
  }

  return adjacency;
}
