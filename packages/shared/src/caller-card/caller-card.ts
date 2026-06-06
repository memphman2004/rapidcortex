import { z } from "zod";
import type { IncidentCategory, IncidentStatus } from "../types.js";
import { premiseHazardTypeSchema } from "./premise-note.js";

export const callerCardLocationSourceSchema = z.enum(["incident", "cad"]);
export type CallerCardLocationSource = z.infer<typeof callerCardLocationSourceSchema>;

export const callerCardLocationSchema = z.object({
  address: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  mapLabel: z.string().max(200).optional(),
  source: callerCardLocationSourceSchema,
});

export type CallerCardLocation = z.infer<typeof callerCardLocationSchema>;

export const priorIncidentAtAddressSourceSchema = z.literal("prior_incidents");

export const callerCardPriorIncidentSchema = z.object({
  incidentId: z.string(),
  createdAt: z.string(),
  incidentType: z.string().max(120).optional(),
  summary: z.string().max(4000).optional(),
  /** @deprecated prefer `resolution` */
  disposition: z.string().max(120).optional(),
  priority: z.string().max(40).optional(),
  resolution: z.string().max(120).optional(),
  relativeTimeLabel: z.string().max(80).optional(),
  source: priorIncidentAtAddressSourceSchema,
});

export type CallerCardPriorIncident = z.infer<typeof callerCardPriorIncidentSchema>;

export const callerCardPremiseNoteSourceSchema = z.literal("manual_note");

export const callerCardPremiseNoteItemSchema = z.object({
  noteId: z.string(),
  text: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().optional(),
  hazardType: premiseHazardTypeSchema.nullable().optional(),
  isHazard: z.boolean().optional(),
  knownOccupants: z.string().max(2000).optional(),
  specialInstructions: z.string().max(5000).optional(),
  source: callerCardPremiseNoteSourceSchema,
});

export type CallerCardPremiseNoteItem = z.infer<typeof callerCardPremiseNoteItemSchema>;

export const cadDataStatusSchema = z.enum(["mock", "live", "unavailable"]);
export type CadDataStatus = z.infer<typeof cadDataStatusSchema>;

export const callerCardCadDataSourceSchema = z.literal("cad");

export const callerCardCadDataSchema = z.object({
  callerName: z.string().max(200).optional(),
  callbackPhone: z.string().max(40).optional(),
  emergencyContacts: z.array(z.string().max(200)).optional(),
  premiseWarnings: z.array(z.string().max(500)).optional(),
  deviceData: z.record(z.string(), z.unknown()).optional(),
  status: cadDataStatusSchema,
  source: callerCardCadDataSourceSchema,
});

export type CallerCardCadData = z.infer<typeof callerCardCadDataSchema>;

export const callerCardAddressTraumaFlagsSchema = z.object({
  count: z.number().int().nonnegative(),
  mostRecentAt: z.string().nullable(),
  /** Human-readable label (e.g. matched wellness keyword). */
  mostRecentTraumaFlagType: z.string().max(400).nullable(),
});

export type CallerCardAddressTraumaFlags = z.infer<typeof callerCardAddressTraumaFlagsSchema>;

/** F7 aggregated caller / premise context for the incident workspace. */
export const getCallerCardResponseSchema = z.object({
  incidentId: z.string(),
  agencyId: z.string(),
  normalizedAddress: z.string().max(520).nullable(),
  location: callerCardLocationSchema,
  priorIncidents: z.array(callerCardPriorIncidentSchema).max(100),
  /** Total prior incidents at this normalized address in the caller-card window (12 months), before list capping. */
  priorIncidentsTotal: z.number().int().nonnegative(),
  /** True when more incidents matched the window than returned in `priorIncidents`. */
  priorIncidentsTruncated: z.boolean().optional(),
  premiseNotes: z.array(callerCardPremiseNoteItemSchema).max(100),
  addressTraumaFlags: callerCardAddressTraumaFlagsSchema,
  cadData: callerCardCadDataSchema,
  provenanceSummary: z.string().max(2000),
  generatedAt: z.string().min(1),
});

export type GetCallerCardResponse = z.infer<typeof getCallerCardResponseSchema>;

/** @deprecated use GetCallerCardResponse */
export type CallerCardResponse = GetCallerCardResponse;

/** Map incident row fields into prior list entry (no import cycle in zod). */
export type PriorIncidentBuildInput = {
  incidentId: string;
  createdAt: string;
  title: string;
  summary: string;
  status: IncidentStatus;
  category: IncidentCategory;
};
