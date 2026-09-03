import { z } from "zod";

export const transitVehicleModeSchema = z.enum([
  "bus",
  "light_rail",
  "commuter_rail",
  "ferry",
  "paratransit",
]);
export type TransitVehicleMode = z.infer<typeof transitVehicleModeSchema>;

export const transitVehicleStatusSchema = z.enum([
  "in_service",
  "delayed",
  "incident",
  "off_route",
  "out_of_service",
]);
export type TransitVehicleStatus = z.infer<typeof transitVehicleStatusSchema>;

export const transitAlertLevelSchema = z.enum([
  "nominal",
  "elevated",
  "high_alert",
  "emergency_stop",
]);
export type TransitAlertLevel = z.infer<typeof transitAlertLevelSchema>;

export const transitIncidentStatusSchema = z.enum([
  "open",
  "assigned",
  "responding",
  "resolved",
  "closed",
]);
export type TransitIncidentStatus = z.infer<typeof transitIncidentStatusSchema>;

export const transitIncidentTypeSchema = z.enum([
  "medical",
  "disturbance",
  "mechanical",
  "accessibility",
  "fare",
  "security",
  "other",
]);
export type TransitIncidentType = z.infer<typeof transitIncidentTypeSchema>;

export const transitVehicleSchema = z.object({
  agencyId: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  mode: transitVehicleModeSchema,
  status: transitVehicleStatusSchema,
  routeId: z.string().trim().max(64).optional(),
  operatorId: z.string().trim().max(64).optional(),
  lastLat: z.number().min(-90).max(90).optional(),
  lastLng: z.number().min(-180).max(180).optional(),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(400).optional(),
  gpsAt: z.string().datetime().optional(),
  cameraIds: z.array(z.string().trim().min(1).max(64)).max(16).optional(),
  passengerLoad: z.number().int().min(0).max(5000).optional(),
  updatedAt: z.string().datetime(),
});
export type TransitVehicle = z.infer<typeof transitVehicleSchema>;

export const transitVehicleUpsertBodySchema = transitVehicleSchema
  .omit({ agencyId: true, updatedAt: true })
  .extend({ updatedAt: z.string().datetime().optional() });
export type TransitVehicleUpsertBody = z.infer<typeof transitVehicleUpsertBodySchema>;

export const transitVehicleGpsBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(400).optional(),
  gpsAt: z.string().datetime().optional(),
});
export type TransitVehicleGpsBody = z.infer<typeof transitVehicleGpsBodySchema>;

export const transitRouteSchema = z.object({
  agencyId: z.string().trim().min(1),
  routeId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  mode: transitVehicleModeSchema,
  color: z.string().trim().max(16).optional(),
  stationIds: z.array(z.string().trim().min(1).max(64)).max(200).optional(),
  active: z.boolean().optional(),
  updatedAt: z.string().datetime(),
});
export type TransitRoute = z.infer<typeof transitRouteSchema>;

export const transitRouteUpsertBodySchema = transitRouteSchema
  .omit({ agencyId: true, updatedAt: true })
  .extend({ updatedAt: z.string().datetime().optional() });
export type TransitRouteUpsertBody = z.infer<typeof transitRouteUpsertBodySchema>;

export const transitStationSchema = z.object({
  agencyId: z.string().trim().min(1),
  stationId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  routeIds: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  adaAccessible: z.boolean().optional(),
  updatedAt: z.string().datetime(),
});
export type TransitStation = z.infer<typeof transitStationSchema>;

export const transitStationUpsertBodySchema = transitStationSchema
  .omit({ agencyId: true, updatedAt: true })
  .extend({ updatedAt: z.string().datetime().optional() });
export type TransitStationUpsertBody = z.infer<typeof transitStationUpsertBodySchema>;

export const transitOperatorSchema = z.object({
  agencyId: z.string().trim().min(1),
  operatorId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(120),
  userId: z.string().trim().max(128).optional(),
  vehicleId: z.string().trim().max(64).optional(),
  onDuty: z.boolean(),
  radioCallsign: z.string().trim().max(32).optional(),
  updatedAt: z.string().datetime(),
});
export type TransitOperator = z.infer<typeof transitOperatorSchema>;

export const transitOperatorUpsertBodySchema = transitOperatorSchema
  .omit({ agencyId: true, updatedAt: true })
  .extend({ updatedAt: z.string().datetime().optional() });
export type TransitOperatorUpsertBody = z.infer<typeof transitOperatorUpsertBodySchema>;

export const transitIncidentSchema = z.object({
  agencyId: z.string().trim().min(1),
  incidentId: z.string().trim().min(1).max(64),
  type: transitIncidentTypeSchema,
  status: transitIncidentStatusSchema,
  summary: z.string().trim().min(1).max(500),
  vehicleId: z.string().trim().max(64).optional(),
  stationId: z.string().trim().max(64).optional(),
  routeId: z.string().trim().max(64).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  escalatedTo911: z.boolean().optional(),
  createdByUserId: z.string().trim().max(128).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
});
export type TransitIncident = z.infer<typeof transitIncidentSchema>;

export const transitIncidentCreateBodySchema = z.object({
  type: transitIncidentTypeSchema,
  summary: z.string().trim().min(1).max(500),
  vehicleId: z.string().trim().max(64).optional(),
  stationId: z.string().trim().max(64).optional(),
  routeId: z.string().trim().max(64).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type TransitIncidentCreateBody = z.infer<typeof transitIncidentCreateBodySchema>;

export const transitIncidentPatchBodySchema = z
  .object({
    status: transitIncidentStatusSchema.optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    escalatedTo911: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });
export type TransitIncidentPatchBody = z.infer<typeof transitIncidentPatchBodySchema>;

export const transitReportSchema = z.object({
  agencyId: z.string().trim().min(1),
  reportId: z.string().trim().min(1).max(64),
  source: z.enum(["qr", "sms", "ops"]),
  summary: z.string().trim().min(1).max(2000),
  vehicleId: z.string().trim().max(64).optional(),
  stationId: z.string().trim().max(64).optional(),
  createdAt: z.string().datetime(),
});
export type TransitReport = z.infer<typeof transitReportSchema>;

export const transitBroadcastBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  audience: z.enum(["all_operators", "by_route", "by_vehicle"]).default("all_operators"),
  routeId: z.string().trim().max(64).optional(),
  vehicleId: z.string().trim().max(64).optional(),
});
export type TransitBroadcastBody = z.infer<typeof transitBroadcastBodySchema>;

export const transitAlertLevelPatchSchema = z.object({
  level: transitAlertLevelSchema,
});
export type TransitAlertLevelPatch = z.infer<typeof transitAlertLevelPatchSchema>;

export const transitAlertStateSchema = z.object({
  agencyId: z.string().trim().min(1),
  level: transitAlertLevelSchema,
  updatedAt: z.string().datetime(),
  updatedByUserId: z.string().trim().max(128).optional(),
});
export type TransitAlertState = z.infer<typeof transitAlertStateSchema>;

export type TransitDashboardStats = {
  vehiclesInService: number;
  vehiclesDelayed: number;
  vehiclesIncident: number;
  activeIncidents: number;
  operatorsOnDuty: number;
  passengerReportsToday: number;
  alertLevel: TransitAlertLevel;
};
