import { z } from "zod";

export const alsGeocodeResultSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  formattedAddress: z.string(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  confidence: z.number().min(0).max(1),
  provider: z.literal("amazon-location"),
});
export type AlsGeocodeResult = z.infer<typeof alsGeocodeResultSchema>;

export const alsGeocodeQuerySchema = z
  .object({
    address: z.string().trim().min(1).max(500).optional(),
    /** Legacy Create Incident BFF used `q` instead of `address`. */
    q: z.string().trim().min(1).max(500).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .transform((value, ctx) => {
    const address = (value.address ?? value.q ?? "").trim();
    if (!address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "address is required",
        path: ["address"],
      });
      return z.NEVER;
    }
    return { address, lat: value.lat, lng: value.lng };
  });
export type AlsGeocodeQuery = z.infer<typeof alsGeocodeQuerySchema>;

export const alsReverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type AlsReverseGeocodeQuery = z.infer<typeof alsReverseGeocodeQuerySchema>;

export const alsRouteQuerySchema = z.object({
  fromLng: z.coerce.number().min(-180).max(180),
  fromLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
});
export type AlsRouteQuery = z.infer<typeof alsRouteQuerySchema>;

export const alsRouteResultSchema = z.object({
  distanceMiles: z.number(),
  durationMinutes: z.number().int().min(0),
  geometry: z.array(z.tuple([z.number(), z.number()])),
  provider: z.literal("amazon-location"),
});
export type AlsRouteResult = z.infer<typeof alsRouteResultSchema>;

export const alsGeofenceUpsertBodySchema = z.object({
  zoneId: z.string().trim().min(1).max(80),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3).max(1000),
});
export type AlsGeofenceUpsertBody = z.infer<typeof alsGeofenceUpsertBodySchema>;

export const alsGeofenceListItemSchema = z.object({
  zoneId: z.string(),
  geofenceId: z.string(),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
});
export type AlsGeofenceListItem = z.infer<typeof alsGeofenceListItemSchema>;

export const alsDevicePositionBodySchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
export type AlsDevicePositionBody = z.infer<typeof alsDevicePositionBodySchema>;

export const alsDevicePositionSchema = z.object({
  userId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  lastUpdatedAt: z.string(),
});
export type AlsDevicePosition = z.infer<typeof alsDevicePositionSchema>;

/** Amazon Location Places V2 hospital-related POI categories. */
export const HOSPITAL_POI_CATEGORIES = [
  "hospital",
  "hospital_emergency_room",
  "hospital_or_health_care_facility",
] as const;

export const alsHospitalSearchQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1000).max(50_000).optional().default(30_000),
  fromLat: z.coerce.number().min(-90).max(90).optional(),
  fromLng: z.coerce.number().min(-180).max(180).optional(),
  erOnly: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "1" || value === "true"),
});
export type AlsHospitalSearchQuery = z.infer<typeof alsHospitalSearchQuerySchema>;

/** Amazon Location Places V2 education POI categories (no kindergarten_and_childcare). */
export const EDUCATION_POI_CATEGORIES = [
  "school",
  "primary_school",
  "secondary_school",
  "higher_education",
] as const;

export const alsEducationSearchQuerySchema = z
  .object({
    centerLat: z.coerce.number().min(-90).max(90),
    centerLng: z.coerce.number().min(-180).max(180),
    west: z.coerce.number().min(-180).max(180).optional(),
    south: z.coerce.number().min(-90).max(90).optional(),
    east: z.coerce.number().min(-180).max(180).optional(),
    north: z.coerce.number().min(-90).max(90).optional(),
    radiusMeters: z.coerce.number().int().min(1_000).max(50_000).optional(),
    fromLat: z.coerce.number().min(-90).max(90).optional(),
    fromLng: z.coerce.number().min(-180).max(180).optional(),
  })
  .superRefine((value, ctx) => {
    const boundCount = [value.west, value.south, value.east, value.north].filter(
      (part) => part !== undefined,
    ).length;
    if (boundCount !== 0 && boundCount !== 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "west, south, east, and north must be supplied together",
      });
      return;
    }
    if (
      value.west !== undefined &&
      value.south !== undefined &&
      value.east !== undefined &&
      value.north !== undefined
    ) {
      if (value.west >= value.east) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "west must be less than east",
        });
      }
      if (value.south >= value.north) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "south must be less than north",
        });
      }
    }
  });
export type AlsEducationSearchQuery = z.infer<typeof alsEducationSearchQuerySchema>;

/** ALS GeofenceId / DeviceId allow alphanumerics, hyphen, period, underscore. */
export function alsScopedId(agencyId: string, localId: string): string {
  const a = agencyId.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 40);
  const z = localId.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 50);
  return `${a}--${z}`.slice(0, 100);
}

export function alsAgencyPrefix(agencyId: string): string {
  return `${agencyId.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 40)}--`;
}
