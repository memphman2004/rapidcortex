import { z } from "zod";
import {
  CALL_ASSIST_MODES,
  CALL_ASSIST_SOURCES,
  CALL_ASSIST_STATES,
  ROUTING_DESTINATION_TYPES,
  TRANSFER_TYPES,
} from "./classifications.js";
import { CAD_PROVIDER_IDS } from "./cad-types.js";
import { retentionPolicySchema } from "./retention.js";
import { callAssistCallbackSettingsSchema } from "./callback.js";
import {
  CALL_ASSIST_TAXONOMY_VERTICALS,
  callAssistAgencyTaxonomySchema,
  callAssistConfidenceThresholdsSchema,
  callAssistDemoScenarioConfigSchema,
  callAssistExternalTransferEntrySchema,
  callAssistOperatingDaySchema,
} from "./taxonomy.js";

export const callAssistUtteranceSchema = z.object({
  sequence: z.number().int().min(0),
  speaker: z.enum(["caller", "assistant", "system", "other"]),
  text: z.string().min(1).max(8000),
  at: z.string().min(1),
  speakerId: z.string().max(64).optional(),
  channel: z.enum(["CUSTOMER", "AGENT", "UNKNOWN"]).optional(),
  diarizationConfidence: z.number().min(0).max(1).optional(),
});
export type CallAssistUtterance = z.infer<typeof callAssistUtteranceSchema>;

export const callIntakeDataSchema = z.object({
  locationText: z.string().max(500).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  locationSource: z.enum(["CALLER", "ANI_ALI", "RAPIDSOS", "GIS", "UNKNOWN"]).optional(),
  incidentTypeHint: z.string().max(120).optional(),
  isInProgress: z.boolean().optional(),
  injuries: z.boolean().optional(),
  injuriesDetail: z.string().max(200).optional(),
  weaponsMentioned: z.boolean().optional(),
  weaponsDetail: z.string().max(120).optional(),
  vehicleYear: z.string().max(8).optional(),
  vehicleMake: z.string().max(80).optional(),
  vehicleModel: z.string().max(80).optional(),
  vehicleColor: z.string().max(40).optional(),
  vehiclePlate: z.string().max(16).optional(),
  suspectDescription: z.string().max(500).optional(),
  apartmentSuite: z.string().max(40).optional(),
  crossStreets: z.string().max(200).optional(),
  directionOfTravel: z.string().max(80).optional(),
  callbackNumber: z.string().max(32).optional(),
  callerName: z.string().max(120).optional(),
  language: z.string().max(8).optional(),
  preferredLanguage: z.string().max(8).optional(),
  addressConfidence: z.number().min(0).max(1).optional(),
  zoneId: z.string().max(64).optional(),
  zoneName: z.string().max(80).optional(),
  jurisdictionMatch: z.boolean().optional(),
  jurisdictionLabel: z.string().max(120).optional(),
  summary: z.string().max(2000).optional(),
});

export const initiateCallAssistSessionSchema = z.object({
  mode: z.enum(CALL_ASSIST_MODES).default("NON_EMERGENCY"),
  source: z.enum(CALL_ASSIST_SOURCES).default("LIVE"),
  ani: z.string().max(32).optional(),
  language: z.string().max(8).optional(),
  ttyMode: z.boolean().optional(),
  connectContactId: z.string().max(128).optional(),
  connectAttributes: z.record(z.string(), z.string()).optional(),
});
export type InitiateCallAssistSessionBody = z.infer<typeof initiateCallAssistSessionSchema>;

export const callAssistUtteranceBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  text: z.string().min(1).max(8000),
  speaker: z.enum(["caller", "assistant", "system", "other"]).default("caller"),
  speakerId: z.string().max(64).optional(),
  participantRole: z.string().max(32).optional(),
});
export type CallAssistUtteranceBody = z.infer<typeof callAssistUtteranceBodySchema>;

export const callAssistForceTransferBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  reason: z.string().min(1).max(500),
  destinationType: z.enum(ROUTING_DESTINATION_TYPES).optional(),
});

export const callAssistCadPushBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  humanReviewApproved: z.literal(true),
});

export const callAssistSurveySubmitSchema = z.object({
  sessionId: z.string().min(1).max(128),
  score: z.number().int().min(1).max(5),
  channel: z.enum(["DTMF", "SMS", "WEB"]),
  comment: z.string().max(1000).optional(),
});

export const callAssistLegalHoldBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  hold: z.boolean(),
  reason: z.string().min(1).max(500),
});

export const callAssistRecordsRequestSchema = z.object({
  requestorName: z.string().min(1).max(200),
  requestorEmail: z.string().email().max(200),
  dateFrom: z.string().min(1).max(40),
  dateTo: z.string().min(1).max(40),
  notes: z.string().max(2000).optional(),
  sessionIds: z.array(z.string().min(1).max(128)).max(200).optional(),
});

export const callAssistExternalAgencyUpsertSchema = z.object({
  externalAgencyId: z.string().min(1).max(64).optional(),
  externalAgencyName: z.string().min(1).max(200),
  phoneNumber: z.string().max(32).default(""),
  sipUri: z.string().max(256).optional(),
  description: z.string().max(500).default(""),
  transferType: z.enum(TRANSFER_TYPES).default("WARM"),
  afterHoursMessage: z.string().max(500).optional(),
  afterHoursAlternative: z.string().max(500).optional(),
  callerExperienceScript: z.string().min(1).max(1000),
  transferSummaryTemplate: z.string().min(1).max(2000),
  enabled: z.boolean().default(true),
  triageClassifications: z.array(z.string().min(1).max(64)).default([]),
  acceptedCallTypes: z.array(z.string().min(1).max(64)).max(40).optional(),
  hoursTimezone: z.string().max(64).optional(),
  hoursAllDay: z.boolean().optional(),
  afterHoursPolicy: z.enum(["message", "fallback", "human"]).optional(),
  fallbackPhoneNumber: z.string().max(32).optional(),
  fallbackSipUri: z.string().max(256).optional(),
  transferFailurePolicy: z.enum(["fallback", "human", "callback"]).optional(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
});

export const callAssistKnowledgeUpsertSchema = z.object({
  articleId: z.string().min(1).max(64).optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  enabled: z.boolean().default(true),
  source: z.string().max(300).optional(),
  sourceType: z.enum(["manual", "url", "policy", "import"]).optional(),
});

export const callAssistDemoRunSchema = z.object({
  scenarioId: z.string().min(1).max(64),
});

export const callAssistAdminConfigPatchSchema = z.object({
  disclosureEnabled: z.boolean().optional(),
  disclosureText: z.string().min(1).max(2000).optional(),
  emergencyDestination: z.string().max(32).optional(),
  demoEmergencyDestination: z.string().max(32).optional(),
  cadProviderId: z.enum(CAD_PROVIDER_IDS).optional(),
  cadProviderLabel: z.string().max(80).nullable().optional(),
  carfaxPortalUrl: z.string().url().max(500).optional().or(z.literal("")),
  onlineReportUrl: z.string().url().max(500).optional().or(z.literal("")),
  operatingHours: z
    .object({
      timezone: z.string().min(1).max(64).optional(),
      openMinutes: z.number().int().min(0).max(24 * 60).optional(),
      closeMinutes: z.number().int().min(0).max(24 * 60).optional(),
      allDay: z.boolean().optional(),
      days: z.array(callAssistOperatingDaySchema).max(7).optional(),
    })
    .optional(),
  retention: retentionPolicySchema.partial().optional(),
  videoAssistEnabled: z.boolean().optional(),
  shortName: z.string().max(80).optional(),
  agencyShortName: z.string().max(80).optional(),
  agencyName: z.string().max(200).optional(),
  agencyDisplayName: z.string().max(200).optional(),
  agencyTypeLabel: z.string().max(80).optional(),
  officerLabel: z.string().max(40).optional(),
  emergencyLine: z.string().max(32).optional(),
  nonEmergencyWebsite: z.string().max(200).optional(),
  openingGreeting: z.string().max(2000).optional(),
  afterHoursMessage: z.string().max(2000).optional(),
  defaultLanguageCode: z.string().max(16).optional(),
  supportedLanguages: z.array(z.string().max(16)).max(12).optional(),
  lexBotId: z.string().max(64).optional(),
  lexBotAliasId: z.string().max(64).optional(),
  lexBotName: z.string().max(100).optional(),
  connectContactFlowId: z.string().max(128).optional(),
  connectQueueArn: z.string().max(512).optional(),
  connectEmergencyQueueArn: z.string().max(512).optional(),
  shiftLabel: z.string().max(80).optional(),
  vertical: z.enum(CALL_ASSIST_TAXONOMY_VERTICALS).optional(),
  uiVertical: z.enum(CALL_ASSIST_TAXONOMY_VERTICALS).optional(),
  alertPickupLine: z.string().max(40).optional(),
  confidenceThresholds: callAssistConfidenceThresholdsSchema.partial().optional(),
  tenantCity: z.string().max(80).optional(),
  tenantState: z.string().max(40).optional(),
  gisZones: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(80),
        polygon: z.array(z.tuple([z.number(), z.number()])).min(3).max(200),
      }),
    )
    .max(50)
    .optional(),
  callback: callAssistCallbackSettingsSchema.partial().optional(),
  selfServiceSmsEnabled: z.boolean().optional(),
  taxonomy: callAssistAgencyTaxonomySchema.nullable().optional(),
  demoScenarios: z.array(callAssistDemoScenarioConfigSchema).max(40).optional(),
  externalTransferList: z.array(callAssistExternalTransferEntrySchema).max(40).optional(),
  onboardingComplete: z.boolean().optional(),
  onboardingCompletedAt: z.string().max(40).nullable().optional(),
});

export const callAssistShiftPatchSchema = z.object({
  currentShift: z.string().min(1).max(80),
});

export type CallAssistAdminConfigPatch = z.infer<typeof callAssistAdminConfigPatchSchema>;

export const callAssistOnboardingInputSchema = z.object({
  agencyId: z.string().min(1).max(128),
  agencyDisplayName: z.string().trim().min(1).max(200),
  agencyShortName: z.string().trim().min(1).max(80),
  agencyTypeLabel: z.string().trim().min(1).max(80),
  officerLabel: z.string().trim().min(1).max(40),
  nonEmergencyWebsite: z.string().trim().max(200).optional(),
  onlineReportPortalUrl: z.string().trim().max(500).optional(),
  carfaxPortalUrl: z.string().trim().max(500).optional(),
  supportedLocales: z.array(z.enum(["en_US", "es_US", "zh_CN", "fr_CA"])).min(1).max(4),
  aiDisclosureRequired: z.boolean(),
  customVocabularyPhrases: z.array(z.string().min(1).max(100)).max(500).optional(),
});

export const callAssistDidClaimSchema = z.object({
  phoneNumber: z.string().min(8).max(20),
});

export const callAssistVoiceConfigPatchSchema = z.object({
  agencyDisplayName: z.string().trim().min(1).max(200).optional(),
  agencyShortName: z.string().trim().min(1).max(80).optional(),
  agencyTypeLabel: z.string().trim().max(80).optional(),
  officerLabel: z.string().trim().max(40).optional(),
  nonEmergencyWebsite: z.string().trim().max(200).optional(),
  onlineReportPortalUrl: z.string().trim().max(500).optional(),
  carfaxPortalUrl: z.string().trim().max(500).optional(),
  disclosureText: z.string().trim().min(1).max(2000).optional(),
  supportedLocales: z.array(z.enum(["en_US", "es_US", "zh_CN", "fr_CA"])).min(1).max(4).optional(),
});

export const callAssistRmsFileBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  humanReviewApproved: z.literal(true),
  target: z.enum(["motorola-records", "tyler-new-world", "mark43"]).optional(),
});

export const callAssistConnectWebhookSchema = z.object({
  agencyId: z.string().min(1).max(128),
  contactId: z.string().min(1).max(128),
  ani: z.string().max(32).optional(),
  eventType: z.enum(["INITIATED", "UTTERANCE", "DTMF", "DISCONNECT", "TRANSFER_RESULT"]).default("INITIATED"),
  text: z.string().max(8000).optional(),
  dtmf: z.string().max(8).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  mediaType: z.string().max(40).optional(),
  transferOutcome: z
    .enum(["ANSWERED", "FAILED", "NO_ANSWER", "BUSY", "REJECTED", "COMPLETED", "CANCELLED"])
    .optional(),
  transferDestination: z.string().max(128).optional(),
  participantRole: z.string().max(32).optional(),
  speakerLabel: z.string().max(32).optional(),
});
export type CallAssistConnectWebhookBody = z.infer<typeof callAssistConnectWebhookSchema>;

export const CALL_ASSIST_STATE_SET = new Set<string>(CALL_ASSIST_STATES);
export const CALL_ASSIST_SOURCE_SET = new Set<string>(CALL_ASSIST_SOURCES);
