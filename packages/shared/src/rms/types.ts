import { z } from "zod";

export const NIBRS_OFFENSE_GROUPS = ["A", "B"] as const;
export type NibrsOffenseGroup = (typeof NIBRS_OFFENSE_GROUPS)[number];

export const REPORT_STATUSES = [
  "draft",
  "reviewed",
  "finalized",
  "pushed_to_rms",
  "exported",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const RMS_PUSH_TARGETS = [
  "tyler-new-world",
  "mark43",
  "axon-records",
  "centralsquare",
] as const;
export type RmsPushTarget = (typeof RMS_PUSH_TARGETS)[number];

export const NibrsAlternativeSchema = z.object({
  offenseCode: z.string().min(1),
  offenseDescription: z.string().min(1),
  confidence: z.number().min(0).max(100),
});

export const NibrsClassificationSchema = z.object({
  offenseCode: z.string().min(1),
  offenseGroup: z.enum(NIBRS_OFFENSE_GROUPS),
  offenseDescription: z.string().min(1),
  locationTypeCode: z.string().min(1),
  locationTypeDescription: z.string().min(1),
  attemptedCompleted: z.enum(["A", "C"]),
  confidence: z.number().min(0).max(100),
  aiRationale: z.string(),
  alternativeCodes: z.array(NibrsAlternativeSchema).optional(),
});
export type NibrsClassification = z.infer<typeof NibrsClassificationSchema>;

export const IncidentReportNarrativeSchema = z.object({
  officerNarrative: z.string(),
  suspectDescription: z.string().optional(),
  victimInformation: z.string().optional(),
  vehicleInformation: z.string().optional(),
  evidenceSummary: z.string().optional(),
  officerObservations: z.string().optional(),
  dispositionSummary: z.string().optional(),
});
export type IncidentReportNarrative = z.infer<typeof IncidentReportNarrativeSchema>;

export const IncidentPersonSchema = z.object({
  role: z.enum(["suspect", "victim", "witness"]),
  name: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  race: z.string().optional(),
  sex: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  hair: z.string().optional(),
  eyes: z.string().optional(),
  clothing: z.string().optional(),
  distinguishingFeatures: z.string().optional(),
  injuryDescription: z.string().optional(),
  extractedFromCall: z.boolean(),
});
export type IncidentPerson = z.infer<typeof IncidentPersonSchema>;

export const IncidentVehicleSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  color: z.string().optional(),
  plate: z.string().optional(),
  plateState: z.string().optional(),
  direction: z.string().optional(),
  description: z.string().optional(),
  extractedFromCall: z.boolean(),
});
export type IncidentVehicle = z.infer<typeof IncidentVehicleSchema>;

export const IncidentReportSchema = z.object({
  reportId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  callId: z.string().optional(),
  incidentType: z.string(),
  incidentDate: z.string(),
  incidentTime: z.string(),
  incidentAddress: z.string(),
  incidentCity: z.string(),
  incidentState: z.string(),
  reportingOfficer: z.string().optional(),
  caseNumber: z.string().optional(),
  cadIncidentNumber: z.string().optional(),
  suspects: z.array(IncidentPersonSchema),
  victims: z.array(IncidentPersonSchema),
  witnesses: z.array(IncidentPersonSchema),
  vehicles: z.array(IncidentVehicleSchema),
  narrative: IncidentReportNarrativeSchema,
  nibrsClassification: NibrsClassificationSchema.optional(),
  nibrsConfirmed: z.boolean(),
  status: z.enum(REPORT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  finalizedBy: z.string().optional(),
  finalizedAt: z.string().optional(),
  rmsPushStatus: z.enum(["pending", "pending_vendor", "pushed", "failed"]).optional(),
  rmsPushTarget: z.string().optional(),
  rmsPushedAt: z.string().optional(),
  rmsExternalId: z.string().optional(),
  transcriptWordCount: z.number().int().nonnegative(),
  extractedEntitiesCount: z.number().int().nonnegative(),
  sourceCallDurationSeconds: z.number().optional(),
});
export type IncidentReport = z.infer<typeof IncidentReportSchema>;

export const GenerateReportRequestSchema = z.object({
  incidentId: z.string().min(1),
  agencyId: z.string().min(1).optional(),
  transcript: z.string().min(1),
  extractedEntities: z.object({
    location: z.string().optional(),
    incidentType: z.string().optional(),
    suspects: z.array(z.record(z.string(), z.string())).optional(),
    victims: z.array(z.record(z.string(), z.string())).optional(),
    vehicles: z.array(z.record(z.string(), z.string())).optional(),
    weapons: z.array(z.string()).optional(),
    injuries: z.string().optional(),
    additionalContext: z.string().optional(),
  }),
  callMetadata: z
    .object({
      callDurationSeconds: z.number().optional(),
      callDate: z.string().optional(),
      callTime: z.string().optional(),
      callerPhone: z.string().optional(),
      cadNumber: z.string().optional(),
    })
    .optional(),
  agencyPreferences: z
    .object({
      narrativeStyle: z.enum(["first_person", "third_person"]).optional(),
      includeCallerStatements: z.boolean().optional(),
      jurisdictionState: z.string().optional(),
    })
    .optional(),
});
export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;

export const PatchIncidentReportSchema = z
  .object({
    narrative: IncidentReportNarrativeSchema.partial().optional(),
    nibrsClassification: NibrsClassificationSchema.optional(),
    nibrsConfirmed: z.boolean().optional(),
    suspects: z.array(IncidentPersonSchema).optional(),
    victims: z.array(IncidentPersonSchema).optional(),
    witnesses: z.array(IncidentPersonSchema).optional(),
    vehicles: z.array(IncidentVehicleSchema).optional(),
    reportingOfficer: z.string().optional(),
    caseNumber: z.string().optional(),
    status: z.enum(["draft", "reviewed"]).optional(),
  })
  .strict();
export type PatchIncidentReport = z.infer<typeof PatchIncidentReportSchema>;

/** Finalize requires an explicit NIBRS confirmation in the request body (CJIS / MSA). */
export const FinalizeIncidentReportSchema = z
  .object({
    nibrsConfirmed: z.literal(true),
  })
  .strict();
export type FinalizeIncidentReport = z.infer<typeof FinalizeIncidentReportSchema>;

export const NibrsClassifyRequestSchema = z.object({
  incidentType: z.string().min(1),
  description: z.string().min(1),
  state: z.string().optional(),
});
export type NibrsClassifyRequest = z.infer<typeof NibrsClassifyRequestSchema>;

export const RmsContextSchema = z.object({
  addressHistory: z
    .object({
      address: z.string(),
      priorIncidentCount: z.number(),
      lastIncidentDate: z.string().optional(),
      lastIncidentType: z.string().optional(),
      hasActiveProtectiveOrder: z.boolean(),
      hasHazardFlag: z.boolean(),
      hazardDescription: z.string().optional(),
      recentIncidents: z.array(
        z.object({
          date: z.string(),
          type: z.string(),
          caseNumber: z.string().optional(),
          disposition: z.string().optional(),
        }),
      ),
    })
    .optional(),
  callerHistory: z
    .object({
      phone: z.string(),
      priorCallCount: z.number(),
      lastCallDate: z.string().optional(),
      lastCallType: z.string().optional(),
      isKnownOffender: z.boolean(),
      hasActiveWarrant: z.boolean(),
    })
    .optional(),
  notes: z.string().optional(),
  dataSource: z.string(),
  retrievedAt: z.string(),
  cached: z.boolean(),
});
export type RmsContext = z.infer<typeof RmsContextSchema>;
