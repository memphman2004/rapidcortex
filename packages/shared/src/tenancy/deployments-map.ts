import { z } from "zod";
import { AGENCY_TYPE_VALUES } from "../tenancy/agency.js";

/** One pin on the RC Admin national deployments map (cross-tenant). */
export const agencyDeploymentMarkerSchema = z.object({
  agencyId: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  type: z.enum(AGENCY_TYPE_VALUES),
  status: z.enum(["draft", "pilot", "active", "suspended", "archived"]),
  vertical: z.enum(["core", "campus", "venue", "hospital"]).optional(),
  state: z.string().min(1).max(50),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const agencyDeploymentsMapResponseSchema = z.object({
  markers: z.array(agencyDeploymentMarkerSchema),
  /** Agencies scanned that lack a usable HQ pin. */
  missingCoordinatesCount: z.number().int().nonnegative(),
  totalAgencies: z.number().int().nonnegative(),
});

export type AgencyDeploymentMarker = z.infer<typeof agencyDeploymentMarkerSchema>;
export type AgencyDeploymentsMapResponse = z.infer<typeof agencyDeploymentsMapResponseSchema>;
