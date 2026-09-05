export function isHttpsOverlayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** ArcGIS Feature Service → GeoJSON query; GeoJSON URLs pass through. */
export function campusOverlayFetchUrl(raw: string): string {
  const url = raw.trim();
  if (!/FeatureServer/i.test(url) || /[?&]f=geojson/i.test(url)) return url;
  const base = url.replace(/\/+$/, "");
  if (/\/query(\?|$)/i.test(base)) {
    return `${base}${base.includes("?") ? "&" : "?"}f=geojson&outFields=*&where=1%3D1`;
  }
  return `${base}/query?where=1%3D1&outFields=*&f=geojson`;
}
