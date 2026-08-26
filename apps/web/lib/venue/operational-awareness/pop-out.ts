export type OperationalPopoutKind = "area" | "facility";

export function operationalMapPopoutPath(
  venueCode: string,
  kind: OperationalPopoutKind,
  incidentId?: string | null,
): string {
  const code = encodeURIComponent(venueCode);
  const suffix = kind === "area" ? "area-map" : "facility-map";
  const path = `/venue/${code}/operations/${suffix}`;
  if (!incidentId) return path;
  const params = new URLSearchParams({ incident: incidentId });
  return `${path}?${params.toString()}`;
}

/** Opens a dedicated window that can be dragged to another operations monitor. */
export function openOperationalMapWindow(
  venueCode: string,
  kind: OperationalPopoutKind,
  incidentId?: string | null,
): Window | null {
  if (typeof window === "undefined") return null;
  const url = operationalMapPopoutPath(venueCode, kind, incidentId);
  const features = [
    "popup=yes",
    "width=1440",
    "height=900",
    "left=60",
    "top=40",
    "menubar=no",
    "toolbar=no",
    "location=yes",
    "status=no",
    "resizable=yes",
    "scrollbars=no",
  ].join(",");
  const name = kind === "area" ? "rc-venue-area-map" : "rc-venue-facility-map";
  return window.open(url, name, features);
}
