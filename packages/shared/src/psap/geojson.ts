import type { PsapMapPin } from "./types.js";

export type PsapMapFeatureProperties = {
  id: string;
  name: string;
  city: string;
  state: string;
  county: string;
  phone: string;
  cadVendor: string;
  psapType: string;
};

export type PsapMapFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: PsapMapFeatureProperties;
  }>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Public map payload only — no emails, notes, outreach status, or sales fields.
 */
export function psapPinsToGeoJSON(
  pins: Array<
    Pick<PsapMapPin, "psapId" | "lat" | "lon" | "psapName" | "state"> & {
      city?: string;
      county?: string;
      phone?: string;
      cadVendor?: string;
      psapType?: string;
    }
  >,
): PsapMapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins
      .filter(
        (pin) =>
          Number.isFinite(pin.lat) &&
          Number.isFinite(pin.lon) &&
          Math.abs(pin.lat) <= 90 &&
          Math.abs(pin.lon) <= 180,
      )
      .map((pin) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [pin.lon, pin.lat] as [number, number],
        },
        properties: {
          id: pin.psapId,
          name: text(pin.psapName) || "PSAP",
          city: text(pin.city),
          state: text(pin.state),
          county: text(pin.county),
          phone: text(pin.phone),
          cadVendor: text(pin.cadVendor),
          psapType: text(pin.psapType),
        },
      })),
  };
}

export function isPsapMapFeatureCollection(value: unknown): value is PsapMapFeatureCollection {
  if (!value || typeof value !== "object") return false;
  const rec = value as { type?: unknown; features?: unknown };
  return rec.type === "FeatureCollection" && Array.isArray(rec.features);
}
