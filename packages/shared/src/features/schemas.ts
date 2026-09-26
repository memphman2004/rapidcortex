import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Enums / unions
// ─────────────────────────────────────────────────────────────────────────────

export const mobilityStatusSchema = z.enum([
  "ambulatory",
  "limited",
  "non_ambulatory",
  "wheelchair",
  "bedridden",
]);

export const enrolledViaSchema = z.enum(["web", "qr", "sms", "phone", "in_person"]);

export const buildingTypeSchema = z.enum([
  "house",
  "apartment",
  "condo",
  "assisted_living",
  "group_home",
  "other",
]);

export const medicalSeveritySchema = z.enum(["mild", "moderate", "severe"]);

export const communicationNeedTypeSchema = z.enum([
  "deaf",
  "hard_of_hearing",
  "speech_impaired",
  "cognitive",
  "autism",
  "other",
]);

export const communicationPreferredMethodSchema = z.enum([
  "text",
  "relay",
  "interpreter",
  "aac_device",
]);

export const citizenMatchOnSchema = z.enum(["phone", "address", "alternate_phone"]);

export const addressHazardTypeSchema = z.enum([
  "hazmat",
  "structural",
  "electrical",
  "gas",
  "water",
  "biological",
  "violence_history",
  "dog",
  "other",
]);

export const hazardSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const facilityTypeSchema = z.enum([
  "residential",
  "commercial",
  "school",
  "hospital",
  "government",
  "industrial",
  "religious",
  "other",
]);

export const floorPlanAnnotationTypeSchema = z.enum([
  "fire_ext",
  "aed",
  "stairwell",
  "elevator",
  "hazmat",
  "electrical_panel",
  "shut_off",
  "custom",
]);

export const alternativeResponseTypeSchema = z.enum([
  "mental_health",
  "substance_use",
  "welfare_check",
  "non_emergency_medical",
  "housing_crisis",
  "domestic_dispute_non_violent",
  "noise_complaint",
  "quality_of_life",
]);

export const alternativeResourceTypeSchema = z.enum([
  "mobile_crisis_team",
  "co_responder",
  "peer_support",
  "social_worker",
  "ems_mental_health",
  "crisis_line",
]);

export const resourceAvailabilityStatusSchema = z.enum([
  "available",
  "busy",
  "unavailable",
  "unknown",
]);

export const supervisorAltDecisionSchema = z.enum(["accept", "reject", "modify"]);

export const altResolutionSchema = z.enum([
  "resolved",
  "escalated_to_ems",
  "escalated_to_law",
  "hospital_transport",
  "no_action_needed",
  "refused_service",
]);

export const coResponderStatusSchema = z.enum([
  "available",
  "responding",
  "on_scene",
  "unavailable",
  "off_shift",
]);

export const resourceRequestStatusSchema = z.enum([
  "open",
  "partially_filled",
  "filled",
  "cancelled",
  "closed",
]);

/** Mutual-aid / MCI priority 1–5 (avoids clash with cad-mesh `Priority`). */
export const mutualAidPrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const commitmentStatusSchema = z.enum([
  "committed",
  "en_route",
  "on_scene",
  "released",
  "cancelled",
]);

export const triageColorSchema = z.enum(["red", "yellow", "green", "black", "gray"]);

export const mciStatusSchema = z.enum([
  "standby",
  "active",
  "stabilizing",
  "closing",
  "closed",
]);

export const mciSeveritySchema = z.enum(["minor", "moderate", "major", "catastrophic"]);

export const patientSexSchema = z.enum(["M", "F", "U"]);

export const transportStatusSchema = z.enum([
  "awaiting",
  "assigned",
  "en_route",
  "arrived",
  "refused",
]);

export const radialPulseSchema = z.enum(["present", "absent"]);

export const capRefillSchema = z.enum(["<2", ">2", "absent"]);

export const traumaLevelSchema = z.enum(["I", "II", "III", "IV", "V", "none"]);

export const infrastructureTypeSchema = z.enum([
  "school_k12",
  "university",
  "hospital",
  "urgent_care",
  "nursing_home",
  "government",
  "courthouse",
  "utility_electric",
  "utility_water",
  "utility_gas",
  "transit_hub",
  "airport",
  "stadium",
  "shopping_center",
  "hotel",
  "highrise_residential",
  "industrial",
  "chemical_plant",
  "religious",
  "other",
]);

export const interpreterMethodSchema = z.enum([
  "ai_translation",
  "live_phone_interpreter",
  "video_remote_interpreting",
  "in_person",
]);

export const interpreterRequestStatusSchema = z.enum([
  "pending",
  "connecting",
  "connected",
  "completed",
  "failed",
  "cancelled",
]);

export const interpreterTriggerReasonSchema = z.enum([
  "dispatcher_request",
  "auto_detect_low_confidence",
  "caller_request",
  "ai_escalation",
]);

export const callQualitySchema = z.enum(["good", "fair", "poor"]);

export const evidenceTypeSchema = z.enum([
  "photo",
  "video",
  "audio",
  "document",
  "transcript",
  "screen_recording",
]);

export const evidenceStatusSchema = z.enum([
  "active",
  "under_hold",
  "released",
  "redacted",
  "purged",
]);

export const evidenceSourceMethodSchema = z.enum([
  "caller_upload",
  "dispatcher_capture",
  "system_generated",
  "body_cam",
  "cctv",
]);

export const chainOfCustodyActionSchema = z.enum([
  "created",
  "viewed",
  "downloaded",
  "shared",
  "hold_placed",
  "hold_released",
  "redacted",
  "released_to_requestor",
  "purge_scheduled",
  "purged",
]);

export const publicRecordsStatusSchema = z.enum([
  "pending",
  "in_review",
  "approved",
  "partially_approved",
  "denied",
  "fulfilled",
]);

export const assessmentStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "expired",
  "reviewed",
]);

export const assessmentDifficultySchema = z.enum(["entry", "intermediate", "advanced"]);

export const patternTypeSchema = z.enum([
  "location_verification_failure",
  "slow_priority_assignment",
  "missed_protocol_step",
  "language_barrier_delay",
  "repeat_caller_address",
  "high_abandon_rate",
  "unit_unavailability",
  "callback_failure",
  "transfer_delay",
  "mci_coordination_gap",
]);

export const learningPatternStatusSchema = z.enum([
  "new",
  "acknowledged",
  "in_remediation",
  "resolved",
  "monitoring",
]);

export const trainingRecommendationTypeSchema = z.enum([
  "scenario_training",
  "protocol_review",
  "coaching_session",
  "policy_update",
  "system_config",
]);

export const recommendationPrioritySchema = z.enum(["high", "medium", "low"]);

export const impactLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const eventTypeSchema = z.enum([
  "sporting_event",
  "concert",
  "festival",
  "marathon",
  "parade",
  "political_rally",
  "fireworks",
  "graduation",
  "fair_expo",
  "extreme_weather",
  "holiday",
  "other",
]);

export const publicEventStatusSchema = z.enum([
  "upcoming",
  "active",
  "completed",
  "cancelled",
]);

export const staffingPrioritySchema = z.enum(["required", "recommended", "optional"]);

export const checkInTimerStatusSchema = z.enum([
  "active",
  "checked_in",
  "escalated",
  "cancelled",
  "expired",
]);

export const escalationLevelSchema = z.enum([
  "supervisor_alert",
  "backup_dispatch",
  "emergency_response",
]);

export const escalationContactMethodSchema = z.enum(["app_push", "sms", "phone", "radio"]);

export const panicTriggeredBySchema = z.enum(["button", "timer_expired", "check_in_missed"]);

export const panicAlertStatusSchema = z.enum(["active", "acknowledged", "resolved"]);

export const socialSourceSchema = z.enum([
  "twitter_x",
  "nextdoor",
  "ring_neighbors",
  "facebook",
  "bluesky",
  "reddit",
  "citizen_app",
]);

/** Social awareness signal class (avoids clash with rapid-iq `signalTypeSchema`). */
export const socialSignalTypeSchema = z.enum([
  "shooting",
  "fire",
  "flooding",
  "accident",
  "fight",
  "suspicious",
  "utility_outage",
  "medical",
  "other",
]);

export const signalStatusSchema = z.enum([
  "unreviewed",
  "reviewed",
  "corroborated",
  "dismissed",
  "linked_to_incident",
]);

export const signalUrgencySchema = z.enum(["low", "medium", "high", "critical"]);

const isoDatetimeSchema = z.string().min(1);
const bcp47Schema = z.string().trim().min(2).max(35);

// ─────────────────────────────────────────────────────────────────────────────
// Nested / shared entity schemas
// ─────────────────────────────────────────────────────────────────────────────

export const citizenAddressSchema = z.object({
  street: z.string().trim().min(1).max(300),
  unit: z.string().trim().max(64).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(64),
  zip: z.string().trim().min(1).max(20),
  lat: z.number().gte(-90).lte(90).optional(),
  lon: z.number().gte(-180).lte(180).optional(),
  buildingType: buildingTypeSchema.optional(),
  floor: z.number().int().optional(),
});

export const medicalFlagSchema = z.object({
  condition: z.string().trim().min(1).max(200),
  severity: medicalSeveritySchema,
  medications: z.array(z.string().trim().max(120)).optional(),
  allergies: z.array(z.string().trim().max(120)).optional(),
  physicianName: z.string().trim().max(120).optional(),
  physicianPhone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const communicationNeedSchema = z.object({
  type: communicationNeedTypeSchema,
  notes: z.string().trim().max(1000).optional(),
  preferredMethod: communicationPreferredMethodSchema.optional(),
});

export const householdMemberSchema = z.object({
  relationship: z.string().trim().min(1).max(80),
  name: z.string().trim().max(120).optional(),
  age: z.number().int().nonnegative().max(150).optional(),
  specialNeeds: z.string().trim().max(500).optional(),
});

export const petSchema = z.object({
  species: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  breed: z.string().trim().max(80).optional(),
  color: z.string().trim().max(80).optional(),
  aggressive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const addressIncidentSummarySchema = z.object({
  incidentId: z.string().trim().min(1).max(128),
  incidentType: z.string().trim().min(1).max(120),
  priority: z.number().int().min(1).max(5),
  date: isoDatetimeSchema,
  disposition: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const addressHazardSchema = z.object({
  hazardId: z.string().trim().min(1).max(128),
  type: addressHazardTypeSchema,
  severity: hazardSeveritySchema,
  description: z.string().trim().min(1).max(2000),
  addedAt: isoDatetimeSchema,
  addedBy: z.string().trim().min(1).max(128),
  expiresAt: isoDatetimeSchema.optional(),
  verified: z.boolean(),
});

export const floorPlanAnnotationSchema = z.object({
  type: floorPlanAnnotationTypeSchema,
  label: z.string().trim().min(1).max(120),
  x: z.number(),
  y: z.number(),
});

export const floorPlanSchema = z.object({
  level: z.string().trim().min(1).max(64),
  s3Key: z.string().trim().min(1).max(512),
  cloudFrontUrl: z.string().trim().min(1).max(1024),
  annotations: z.array(floorPlanAnnotationSchema).optional(),
  uploadedAt: isoDatetimeSchema,
});

export const fireProtectionInfoSchema = z.object({
  sprinklerSystem: z.boolean(),
  standpipeSystem: z.boolean(),
  fireAlarmSystem: z.boolean(),
  knoxBoxLocation: z.string().trim().max(200).optional(),
  hydrantCount: z.number().int().nonnegative().optional(),
});

export const prePlanContactSchema = z.object({
  role: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(32),
  email: z.string().trim().email().max(254).optional(),
  available24h: z.boolean(),
});

export const hazmatLocationSchema = z.object({
  material: z.string().trim().min(1).max(200),
  unNumber: z.string().trim().max(32).optional(),
  quantity: z.string().trim().max(80).optional(),
  storageLocation: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

export const buildingInfoSchema = z.object({
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  stories: z.number().int().positive().optional(),
  units: z.number().int().positive().optional(),
  constructionType: z.string().trim().max(120).optional(),
  roofType: z.string().trim().max(120).optional(),
  occupancyLoad: z.number().int().nonnegative().optional(),
});

export const utilitiesInfoSchema = z.object({
  gasShutoffLocation: z.string().trim().max(200).optional(),
  electricalPanelLocation: z.string().trim().max(200).optional(),
  waterShutoffLocation: z.string().trim().max(200).optional(),
  utilityProvider: z.string().trim().max(120).optional(),
  utilityAccountNumber: z.string().trim().max(80).optional(),
  emergencyUtilityContact: z.string().trim().max(120).optional(),
});

export const stagingAreaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  lat: z.number().gte(-90).lte(90).optional(),
  lon: z.number().gte(-180).lte(180).optional(),
});

export const addressPrePlanSchema = z.object({
  prePlanId: z.string().trim().min(1).max(128),
  buildingName: z.string().trim().max(200).optional(),
  facilityType: facilityTypeSchema,
  occupancy: z.string().trim().max(200).optional(),
  constructionType: z.string().trim().max(120).optional(),
  floors: z.number().int().positive().optional(),
  totalSqFt: z.number().nonnegative().optional(),
  floorPlans: z.array(floorPlanSchema).optional(),
  fireProtection: fireProtectionInfoSchema.optional(),
  contacts: z.array(prePlanContactSchema),
  hazmatLocations: z.array(hazmatLocationSchema).optional(),
  utilities: utilitiesInfoSchema.optional(),
  stagingAreas: z.array(stagingAreaSchema).optional(),
  notes: z.string().trim().max(4000).optional(),
  lastInspectedAt: isoDatetimeSchema.optional(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const locationLatLonSchema = z.object({
  address: z.string().trim().min(1).max(400),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

export const alternativeResourceSchema = z.object({
  resourceId: z.string().trim().min(1).max(128),
  resourceType: alternativeResourceTypeSchema,
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(32).optional(),
  availabilityStatus: resourceAvailabilityStatusSchema,
  estimatedResponseMins: z.number().nonnegative().optional(),
  coverageArea: z.string().trim().max(200).optional(),
  specializations: z.array(z.string().trim().max(80)).optional(),
});

export const alternativeResponseOutcomeSchema = z.object({
  resourceDeployed: z.string().trim().min(1).max(200),
  responseTime: z.number().nonnegative().optional(),
  resolution: altResolutionSchema,
  notes: z.string().trim().max(2000).optional(),
  followUpRequired: z.boolean(),
  recordedAt: isoDatetimeSchema,
  recordedBy: z.string().trim().min(1).max(128),
});

export const resourceNeedSchema = z.object({
  needId: z.string().trim().min(1).max(128),
  resourceType: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive(),
  filledQuantity: z.number().int().nonnegative(),
  qualifications: z.array(z.string().trim().max(120)).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const committedResourceSchema = z.object({
  unitId: z.string().trim().min(1).max(128),
  unitType: z.string().trim().min(1).max(80),
  unitName: z.string().trim().min(1).max(120),
  personnelCount: z.number().int().positive().optional(),
});

export const resourceCommitmentSchema = z.object({
  commitmentId: z.string().trim().min(1).max(128),
  committingAgencyId: z.string().trim().min(1).max(128),
  committingAgencyName: z.string().trim().min(1).max(200),
  resources: z.array(committedResourceSchema).min(1),
  status: commitmentStatusSchema,
  estimatedArrival: isoDatetimeSchema.optional(),
  actualArrival: isoDatetimeSchema.optional(),
  releasedAt: isoDatetimeSchema.optional(),
  committedAt: isoDatetimeSchema,
  committedBy: z.string().trim().min(1).max(128),
});

export const triageSummarySchema = z.object({
  red: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  green: z.number().int().nonnegative(),
  black: z.number().int().nonnegative(),
  gray: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  transported: z.number().int().nonnegative(),
  awaiting: z.number().int().nonnegative(),
});

export const vitalSignsSchema = z.object({
  respiratoryRate: z.number().nonnegative().optional(),
  radialPulse: radialPulseSchema.optional(),
  gcs: z.number().int().min(3).max(15).optional(),
  spo2: z.number().min(0).max(100).optional(),
  systolicBP: z.number().nonnegative().optional(),
  capRefill: capRefillSchema.optional(),
});

export const hospitalAcceptingPatientsSchema = z.object({
  trauma: z.boolean(),
  pediatric: z.boolean(),
  burn: z.boolean(),
  cardiac: z.boolean(),
  stroke: z.boolean(),
});

export const hospitalCapacityEntrySchema = z.object({
  hospitalId: z.string().trim().min(1).max(128),
  hospitalName: z.string().trim().min(1).max(200),
  traumaLevel: traumaLevelSchema,
  distanceMiles: z.number().nonnegative().optional(),
  estimatedMinutes: z.number().nonnegative().optional(),
  diversion: z.boolean(),
  diversionType: z.string().trim().max(120).optional(),
  availableBeds: z.number().int().nonnegative().optional(),
  acceptingPatients: hospitalAcceptingPatientsSchema,
  lastUpdated: isoDatetimeSchema,
});

export const infraContactSchema = z.object({
  role: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(32),
  altPhone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(254).optional(),
});

/** Infra pre-plan protocol step (avoids clash with protocol pack `ProtocolStep`). */
export const infraProtocolStepSchema = z.object({
  order: z.number().int().nonnegative(),
  action: z.string().trim().min(1).max(1000),
  responsible: z.string().trim().max(120).optional(),
  timeframe: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const incidentProtocolSchema = z.object({
  protocolId: z.string().trim().min(1).max(128),
  incidentType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  steps: z.array(infraProtocolStepSchema),
  contacts: z.array(infraContactSchema),
  resources: z.array(z.string().trim().max(200)).optional(),
  lastUpdatedAt: isoDatetimeSchema,
});

export const accessPointSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  keyCode: z.string().trim().max(64).optional(),
  requiresEscort: z.boolean().optional(),
});

export const infraAddressSchema = z.object({
  street: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(64),
  zip: z.string().trim().min(1).max(20),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

export const chainOfCustodyEntrySchema = z.object({
  entryId: z.string().trim().min(1).max(128),
  action: chainOfCustodyActionSchema,
  userId: z.string().trim().min(1).max(128),
  userName: z.string().trim().min(1).max(200),
  userRole: z.string().trim().min(1).max(80),
  purpose: z.string().trim().min(1).max(1000),
  ipAddress: z.string().trim().max(64).optional(),
  timestamp: isoDatetimeSchema,
});

export const publicRecordsRequestRecordSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
  requestorName: z.string().trim().min(1).max(200),
  requestorOrg: z.string().trim().max(200).optional(),
  requestorEmail: z.string().trim().email().max(254),
  requestedAt: isoDatetimeSchema,
  dueDate: isoDatetimeSchema.optional(),
  status: publicRecordsStatusSchema,
  redactionRequired: z.boolean(),
  redactionReason: z.string().trim().max(1000).optional(),
  fulfilledAt: isoDatetimeSchema.optional(),
  fulfilledBy: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const expectedActionSchema = z.object({
  actionId: z.string().trim().min(1).max(128),
  description: z.string().trim().min(1).max(500),
  weight: z.number().min(0).max(100),
  required: z.boolean(),
  timeframeSeconds: z.number().int().positive().optional(),
});

export const rubricCategorySchema = z.object({
  categoryId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(120),
  weight: z.number().min(0).max(100),
  criteria: z.array(z.string().trim().max(500)),
});

export const assessmentRubricSchema = z.object({
  categories: z.array(rubricCategorySchema),
  passingScore: z.number().min(0).max(100),
  totalPoints: z.number().nonnegative(),
});

/** Dispatcher assessment scenario result (avoids clash with demo `ScenarioResult`). */
export const assessmentScenarioResultSchema = z.object({
  scenarioId: z.string().trim().min(1).max(128),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  actionsCompleted: z.array(z.string().trim().min(1).max(128)),
  actionsMissed: z.array(z.string().trim().min(1).max(128)),
  timeToFirstAction: z.number().nonnegative().optional(),
  totalTimeSeconds: z.number().nonnegative().optional(),
  transcriptS3Key: z.string().trim().max(512).optional(),
  aiEvaluation: z.string().trim().max(4000).optional(),
  categoryScores: z.record(z.string(), z.number()),
});

export const trainingRecommendationSchema = z.object({
  recommendationId: z.string().trim().min(1).max(128),
  type: trainingRecommendationTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  priority: recommendationPrioritySchema,
  estimatedEffort: z.string().trim().max(120).optional(),
  linkedScenarioId: z.string().trim().max(128).optional(),
  linkedProtocolId: z.string().trim().max(128).optional(),
});

export const surgeModelSchema = z.object({
  modelId: z.string().trim().min(1).max(128),
  predictedCallVolume: z.number().nonnegative(),
  confidenceInterval: z.tuple([z.number(), z.number()]),
  callTypeBreakdown: z.record(z.string(), z.number()),
  peakHour: isoDatetimeSchema.optional(),
  modelBasis: z.string().trim().min(1).max(500),
  generatedAt: isoDatetimeSchema,
});

export const staffingRecommendationSchema = z.object({
  recommendationId: z.string().trim().min(1).max(128),
  role: z.string().trim().min(1).max(120),
  additionalStaffNeeded: z.number().int().nonnegative(),
  startAt: isoDatetimeSchema,
  endAt: isoDatetimeSchema,
  justification: z.string().trim().min(1).max(2000),
  priority: staffingPrioritySchema,
});

export const escalationContactSchema = z.object({
  order: z.number().int().nonnegative(),
  role: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  method: escalationContactMethodSchema,
  contactValue: z.string().trim().min(1).max(200),
});

export const socialLocationSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  address: z.string().trim().max(400).optional(),
  radius: z.number().nonnegative().optional(),
});

export const eventAddressSchema = z.object({
  street: z.string().trim().min(1).max(300),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

export const pirPeriodSchema = z.object({
  start: isoDatetimeSchema,
  end: isoDatetimeSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Top-level entity schemas
// ─────────────────────────────────────────────────────────────────────────────

export const citizenProfileSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  profileId: z.string().trim().min(1).max(128),
  phoneE164: z.string().trim().min(8).max(20),
  alternatePhones: z.array(z.string().trim().max(20)).optional(),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  preferredName: z.string().trim().max(120).optional(),
  primaryLanguage: bcp47Schema,
  additionalLanguages: z.array(bcp47Schema).optional(),
  address: citizenAddressSchema,
  medicalConditions: z.array(medicalFlagSchema).optional(),
  mobilityStatus: mobilityStatusSchema,
  communicationNeeds: z.array(communicationNeedSchema).optional(),
  householdMembers: z.array(householdMemberSchema).optional(),
  pets: z.array(petSchema).optional(),
  accessNotes: z.string().trim().max(2000).optional(),
  specialInstructions: z.string().trim().max(2000).optional(),
  consentVersion: z.string().trim().min(1).max(64),
  consentSignedAt: isoDatetimeSchema,
  enrolledVia: enrolledViaSchema,
  agencyIds: z.array(z.string().trim().min(1).max(128)),
  verifiedAt: isoDatetimeSchema.optional(),
  lastUpdatedAt: isoDatetimeSchema,
  createdAt: isoDatetimeSchema,
  ttl: z.number().int().positive().optional(),
});

export const citizenLookupResultSchema = z.object({
  profile: citizenProfileSchema,
  matchedOn: citizenMatchOnSchema,
  confidence: z.number().min(0).max(1),
  isVerified: z.boolean(),
});

export const addressIntelligenceSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  addressId: z.string().trim().min(1).max(128),
  normalizedAddress: z.string().trim().min(1).max(500),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  geohash: z.string().trim().min(1).max(16),
  incidentHistory: z.array(addressIncidentSummarySchema),
  totalIncidents: z.number().int().nonnegative(),
  lastIncidentAt: isoDatetimeSchema.optional(),
  incidentTypeBreakdown: z.record(z.string(), z.number()),
  hazards: z.array(addressHazardSchema),
  prePlan: addressPrePlanSchema.optional(),
  buildingInfo: buildingInfoSchema.optional(),
  utilitiesInfo: utilitiesInfoSchema.optional(),
  knownOccupantCount: z.number().int().nonnegative().optional(),
  hasSpecialNeedsOccupant: z.boolean().optional(),
  hasNonAmbulatoryOccupant: z.boolean().optional(),
  accessNotes: z.string().trim().max(2000).optional(),
  gateCode: z.string().trim().max(64).optional(),
  lockboxCode: z.string().trim().max(64).optional(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  lastEnrichedAt: isoDatetimeSchema.optional(),
});

export const alternativeResponseFlagSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  incidentId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  flagType: alternativeResponseTypeSchema,
  triggerSignals: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  suggestedResources: z.array(alternativeResourceSchema),
  supervisorAlerted: z.boolean(),
  supervisorDecision: supervisorAltDecisionSchema.optional(),
  supervisorUserId: z.string().trim().max(128).optional(),
  supervisorDecidedAt: isoDatetimeSchema.optional(),
  finalDispatch: z.string().trim().max(500).optional(),
  outcome: alternativeResponseOutcomeSchema.optional(),
  createdAt: isoDatetimeSchema,
});

export const coResponderUnitSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  unitId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  unitName: z.string().trim().min(1).max(200),
  type: alternativeResourceTypeSchema,
  teamMembers: z.array(z.string().trim().max(120)),
  specializations: z.array(alternativeResponseTypeSchema),
  shiftStart: isoDatetimeSchema.optional(),
  shiftEnd: isoDatetimeSchema.optional(),
  currentStatus: coResponderStatusSchema,
  currentIncidentId: z.string().trim().max(128).optional(),
  coverageZone: z.string().trim().max(200).optional(),
  phone: z.string().trim().min(1).max(32),
  updatedAt: isoDatetimeSchema,
});

export const mutualAidRequestSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  requestId: z.string().trim().min(1).max(128),
  requestingAgencyId: z.string().trim().min(1).max(128),
  requestingAgencyName: z.string().trim().min(1).max(200),
  incidentId: z.string().trim().max(128).optional(),
  incidentType: z.string().trim().max(120).optional(),
  priority: mutualAidPrioritySchema,
  status: resourceRequestStatusSchema,
  resourcesNeeded: z.array(resourceNeedSchema),
  resourcesCommitted: z.array(resourceCommitmentSchema),
  location: locationLatLonSchema,
  requestNotes: z.string().trim().max(4000).optional(),
  icsFormNumber: z.string().trim().max(64).optional(),
  requestedAt: isoDatetimeSchema,
  neededBy: isoDatetimeSchema.optional(),
  closedAt: isoDatetimeSchema.optional(),
  closedBy: z.string().trim().max(128).optional(),
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
});

export const mciEventSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  mciId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  incidentType: z.string().trim().min(1).max(120),
  location: locationLatLonSchema,
  status: mciStatusSchema,
  severity: mciSeveritySchema,
  casualtyEstimate: z.number().int().nonnegative().optional(),
  commanderUserId: z.string().trim().max(128).optional(),
  commanderName: z.string().trim().max(200).optional(),
  linkedIncidentId: z.string().trim().max(128).optional(),
  linkedCADIncidentId: z.string().trim().max(128).optional(),
  triageSummary: triageSummarySchema,
  hospitalBoard: z.array(hospitalCapacityEntrySchema),
  activatedAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  closedAt: isoDatetimeSchema.optional(),
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
});

/** MCI command-console patient (avoids clash with hospital-routing `mciPatientSchema`). */
export const mciCommandPatientSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  patientId: z.string().trim().min(1).max(128),
  mciId: z.string().trim().min(1).max(128),
  tagNumber: z.string().trim().min(1).max(64),
  triageColor: triageColorSchema,
  zone: z.string().trim().min(1).max(120),
  chiefComplaint: z.string().trim().max(500).optional(),
  age: z.string().trim().max(32).optional(),
  sex: patientSexSchema.optional(),
  vitalSigns: vitalSignsSchema.optional(),
  transportStatus: transportStatusSchema,
  assignedHospital: z.string().trim().max(200).optional(),
  assignedUnit: z.string().trim().max(128).optional(),
  departedAt: isoDatetimeSchema.optional(),
  arrivedAt: isoDatetimeSchema.optional(),
  lastUpdatedAt: isoDatetimeSchema,
  updatedBy: z.string().trim().min(1).max(128),
});

export const criticalInfrastructureSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  infraId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  infraType: infrastructureTypeSchema,
  address: infraAddressSchema,
  primaryContact: infraContactSchema,
  afterHoursContact: infraContactSchema.optional(),
  securityContact: infraContactSchema.optional(),
  occupancyLoad: z.number().int().nonnegative().optional(),
  operatingHours: z.string().trim().max(200).optional(),
  floorPlans: z.array(floorPlanSchema),
  protocols: z.array(incidentProtocolSchema),
  hazards: z.array(addressHazardSchema),
  utilities: utilitiesInfoSchema.optional(),
  stagingAreas: z.array(stagingAreaSchema).optional(),
  accessPoints: z.array(accessPointSchema).optional(),
  notes: z.string().trim().max(4000).optional(),
  cleryActReporting: z.boolean().optional(),
  lastReviewedAt: isoDatetimeSchema.optional(),
  reviewedBy: z.string().trim().max(128).optional(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
});

export const interpreterRequestSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  requestId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  incidentId: z.string().trim().min(1).max(128),
  dispatcherId: z.string().trim().min(1).max(128),
  language: bcp47Schema,
  languageDisplayName: z.string().trim().min(1).max(120),
  triggerReason: interpreterTriggerReasonSchema,
  aiConfidenceAtEscalation: z.number().min(0).max(1).optional(),
  method: interpreterMethodSchema,
  status: interpreterRequestStatusSchema,
  serviceProvider: z.string().trim().max(120).optional(),
  interpreterName: z.string().trim().max(120).optional(),
  interpreterNumber: z.string().trim().max(64).optional(),
  connectionStartedAt: isoDatetimeSchema.optional(),
  connectedAt: isoDatetimeSchema.optional(),
  disconnectedAt: isoDatetimeSchema.optional(),
  durationSeconds: z.number().nonnegative().optional(),
  callQuality: callQualitySchema.optional(),
  lepComplianceNotes: z.string().trim().max(2000).optional(),
  requestedAt: isoDatetimeSchema,
  resolvedAt: isoDatetimeSchema.optional(),
});

export const languageAccessRecordSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  recordId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  incidentId: z.string().trim().min(1).max(128),
  language: bcp47Schema,
  methodsUsed: z.array(interpreterMethodSchema),
  totalDurationSeconds: z.number().nonnegative(),
  adequateLanguageAccess: z.boolean(),
  date: z.string().trim().min(8).max(32),
});

export const evidenceRecordSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  evidenceId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  incidentId: z.string().trim().min(1).max(128),
  evidenceType: evidenceTypeSchema,
  sourceMethod: evidenceSourceMethodSchema,
  originalFilename: z.string().trim().max(260).optional(),
  s3Key: z.string().trim().min(1).max(512),
  s3Bucket: z.string().trim().min(1).max(128),
  mimeType: z.string().trim().min(1).max(120),
  fileSizeBytes: z.number().int().nonnegative(),
  sha256Hash: z.string().trim().min(1).max(128),
  status: evidenceStatusSchema,
  holdReason: z.string().trim().max(1000).optional(),
  holdOrderedBy: z.string().trim().max(128).optional(),
  holdOrderedAt: isoDatetimeSchema.optional(),
  redactedVersionKey: z.string().trim().max(512).optional(),
  chain: z.array(chainOfCustodyEntrySchema),
  publicRecordsRequests: z.array(publicRecordsRequestRecordSchema),
  retentionDays: z.number().int().positive(),
  purgeAt: isoDatetimeSchema.optional(),
  uploadedAt: isoDatetimeSchema,
  ttl: z.number().int().positive().optional(),
});

export const assessmentScenarioSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  scenarioId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().max(128).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  callType: z.string().trim().min(1).max(120),
  difficulty: assessmentDifficultySchema,
  audioS3Key: z.string().trim().max(512).optional(),
  transcriptS3Key: z.string().trim().max(512).optional(),
  expectedActions: z.array(expectedActionSchema),
  rubric: assessmentRubricSchema,
  durationSeconds: z.number().int().positive(),
  tags: z.array(z.string().trim().max(64)).optional(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const assessmentSessionSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  sessionId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  applicantId: z.string().trim().min(1).max(128),
  applicantName: z.string().trim().min(1).max(200),
  applicantEmail: z.string().trim().email().max(254),
  scenariosAssigned: z.array(z.string().trim().min(1).max(128)),
  status: assessmentStatusSchema,
  totalScore: z.number().min(0).max(100).optional(),
  passingScore: z.number().min(0).max(100),
  passed: z.boolean().optional(),
  scenarioResults: z.array(assessmentScenarioResultSchema),
  reviewedBy: z.string().trim().max(128).optional(),
  reviewedAt: isoDatetimeSchema.optional(),
  reviewNotes: z.string().trim().max(4000).optional(),
  startedAt: isoDatetimeSchema.optional(),
  completedAt: isoDatetimeSchema.optional(),
  expiresAt: isoDatetimeSchema,
  createdAt: isoDatetimeSchema,
});

export const learningPatternSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  patternId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  patternType: patternTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  frequency: z.number().int().nonnegative(),
  lookbackDays: z.number().int().positive(),
  impactScore: z.number().min(0).max(100),
  affectedIncidentIds: z.array(z.string().trim().min(1).max(128)),
  evidenceSnippets: z.array(z.string().trim().max(1000)),
  recommendations: z.array(trainingRecommendationSchema),
  rootCauseHypothesis: z.string().trim().max(2000).optional(),
  status: learningPatternStatusSchema,
  acknowledgedBy: z.string().trim().max(128).optional(),
  acknowledgedAt: isoDatetimeSchema.optional(),
  resolvedAt: isoDatetimeSchema.optional(),
  detectedAt: isoDatetimeSchema,
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
});

export const pirInsightSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  insightId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  sourcePIRIds: z.array(z.string().trim().min(1).max(128)),
  theme: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  frequency: z.number().int().nonnegative(),
  impactLevel: impactLevelSchema,
  recommendations: z.array(z.string().trim().max(1000)),
  generatedAt: isoDatetimeSchema,
  period: pirPeriodSchema,
});

export const publicEventSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  eventId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  eventType: eventTypeSchema,
  venue: z.string().trim().max(200).optional(),
  address: eventAddressSchema.optional(),
  expectedAttendance: z.number().int().nonnegative().optional(),
  startAt: isoDatetimeSchema,
  endAt: isoDatetimeSchema,
  surgeModel: surgeModelSchema.optional(),
  staffingRecommendations: z.array(staffingRecommendationSchema).optional(),
  status: publicEventStatusSchema,
  sourceUrl: z.string().trim().url().max(1024).optional(),
  autoDetected: z.boolean(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const checkInTimerSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  timerId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  unitId: z.string().trim().min(1).max(128),
  unitName: z.string().trim().min(1).max(200),
  dispatcherId: z.string().trim().min(1).max(128),
  incidentId: z.string().trim().max(128).optional(),
  incidentAddress: z.string().trim().max(400).optional(),
  durationMinutes: z.number().positive(),
  status: checkInTimerStatusSchema,
  escalationContacts: z.array(escalationContactSchema),
  escalationLevel: escalationLevelSchema.optional(),
  escalationStartedAt: isoDatetimeSchema.optional(),
  checkedInAt: isoDatetimeSchema.optional(),
  checkedInBy: z.string().trim().max(128).optional(),
  cancelledAt: isoDatetimeSchema.optional(),
  cancelledBy: z.string().trim().max(128).optional(),
  startedAt: isoDatetimeSchema,
  expiresAt: isoDatetimeSchema,
  ttl: z.number().int().positive(),
});

export const panicAlertSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  alertId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  unitId: z.string().trim().min(1).max(128),
  unitName: z.string().trim().min(1).max(200),
  triggeredBy: panicTriggeredBySchema,
  lat: z.number().gte(-90).lte(90).optional(),
  lon: z.number().gte(-180).lte(180).optional(),
  incidentId: z.string().trim().max(128).optional(),
  status: panicAlertStatusSchema,
  acknowledgedBy: z.string().trim().max(128).optional(),
  acknowledgedAt: isoDatetimeSchema.optional(),
  resolvedAt: isoDatetimeSchema.optional(),
  triggeredAt: isoDatetimeSchema,
  ttl: z.number().int().positive(),
});

export const socialSignalSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  signalId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  source: socialSourceSchema,
  signalType: socialSignalTypeSchema,
  rawText: z.string().trim().min(1).max(8000),
  summary: z.string().trim().min(1).max(1000),
  location: socialLocationSchema.optional(),
  confidence: z.number().min(0).max(1),
  urgency: signalUrgencySchema,
  status: signalStatusSchema,
  linkedIncidentId: z.string().trim().max(128).optional(),
  linkedBy: z.string().trim().max(128).optional(),
  linkedAt: isoDatetimeSchema.optional(),
  reviewedBy: z.string().trim().max(128).optional(),
  reviewedAt: isoDatetimeSchema.optional(),
  dismissalReason: z.string().trim().max(1000).optional(),
  sourceUrl: z.string().trim().url().max(1024).optional(),
  detectedAt: isoDatetimeSchema,
  ttl: z.number().int().positive(),
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Request body schemas (handler ops)
// ─────────────────────────────────────────────────────────────────────────────

export const registerCitizenRequestSchema = z.object({
  phoneE164: z.string().trim().min(8).max(20),
  alternatePhones: z.array(z.string().trim().max(20)).optional(),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  preferredName: z.string().trim().max(120).optional(),
  primaryLanguage: bcp47Schema,
  additionalLanguages: z.array(bcp47Schema).optional(),
  address: citizenAddressSchema,
  medicalConditions: z.array(medicalFlagSchema).optional(),
  mobilityStatus: mobilityStatusSchema,
  communicationNeeds: z.array(communicationNeedSchema).optional(),
  householdMembers: z.array(householdMemberSchema).optional(),
  pets: z.array(petSchema).optional(),
  accessNotes: z.string().trim().max(2000).optional(),
  specialInstructions: z.string().trim().max(2000).optional(),
  consentVersion: z.string().trim().min(1).max(64),
  consentSignedAt: isoDatetimeSchema,
  enrolledVia: enrolledViaSchema,
  agencyIds: z.array(z.string().trim().min(1).max(128)).default([]),
  verifiedAt: isoDatetimeSchema.optional(),
  ttl: z.number().int().positive().optional(),
});

export const updateCitizenRequestSchema = registerCitizenRequestSchema
  .partial()
  .extend({
    phoneE164: z.string().trim().min(8).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const depositIncidentIntelligenceRequestSchema = z.object({
  address: z.object({
    street: z.string().trim().min(1).max(300),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(1).max(64),
    zip: z.string().trim().min(1).max(20),
  }),
  incidentId: z.string().trim().min(1).max(128),
  incidentType: z.string().trim().min(1).max(120),
  priority: z.number().int().min(1).max(5),
  disposition: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

export const addAddressHazardRequestSchema = z.object({
  normalizedAddress: z.string().trim().min(1).max(500),
  geohash8: z.string().trim().min(1).max(16),
  hazard: z.object({
    type: addressHazardTypeSchema,
    severity: hazardSeveritySchema,
    description: z.string().trim().min(1).max(2000),
    expiresAt: isoDatetimeSchema.optional(),
  }),
});

export const upsertPrePlanRequestSchema = z.object({
  normalizedAddress: z.string().trim().min(1).max(500),
  geohash8: z.string().trim().min(1).max(16),
  prePlan: addressPrePlanSchema.partial({
    prePlanId: true,
    createdAt: true,
    updatedAt: true,
  }).extend({
    facilityType: facilityTypeSchema,
    contacts: z.array(prePlanContactSchema),
  }),
});

export const floorPlanUploadUrlRequestSchema = z.object({
  prePlanId: z.string().trim().min(1).max(128),
  level: z.string().trim().min(1).max(64),
  mimeType: z.string().trim().max(120).optional(),
});

export const evaluateAltResponseRequestSchema = z.object({
  agencyId: z.string().trim().min(1).max(128),
  incidentId: z.string().trim().min(1).max(128),
  transcript: z.string().trim().min(1).max(50000),
  callType: z.string().trim().max(120).optional(),
});

export const supervisorAltDecisionRequestSchema = z.object({
  decision: supervisorAltDecisionSchema,
  finalDispatch: z.string().trim().max(500).optional(),
});

export const altOutcomeRequestSchema = z.object({
  resourceDeployed: z.string().trim().min(1).max(200),
  responseTime: z.number().nonnegative().optional(),
  resolution: altResolutionSchema,
  notes: z.string().trim().max(2000).optional(),
  followUpRequired: z.boolean(),
});

export const createMutualAidRequestSchema = z.object({
  requestingAgencyName: z.string().trim().min(1).max(200),
  incidentId: z.string().trim().max(128).optional(),
  incidentType: z.string().trim().max(120).optional(),
  priority: mutualAidPrioritySchema.optional(),
  resourcesNeeded: z
    .array(
      z.object({
        resourceType: z.string().trim().min(1).max(120),
        quantity: z.number().int().positive(),
        qualifications: z.array(z.string().trim().max(120)).optional(),
        notes: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1),
  location: locationLatLonSchema,
  requestNotes: z.string().trim().max(4000).optional(),
  icsFormNumber: z.string().trim().max(64).optional(),
  neededBy: isoDatetimeSchema.optional(),
});

export const commitMutualAidRequestSchema = z.object({
  committingAgencyName: z.string().trim().min(1).max(200),
  resources: z.array(committedResourceSchema).min(1),
  estimatedArrival: isoDatetimeSchema.optional(),
});

export const updateCommitmentStatusRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
  commitmentId: z.string().trim().min(1).max(128),
  status: commitmentStatusSchema,
});

export const activateMciRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  incidentType: z.string().trim().max(120).optional(),
  location: locationLatLonSchema,
  severity: mciSeveritySchema.optional(),
  casualtyEstimate: z.number().int().nonnegative().optional(),
  linkedIncidentId: z.string().trim().max(128).optional(),
  linkedCADIncidentId: z.string().trim().max(128).optional(),
});

export const addMciPatientRequestSchema = z.object({
  tagNumber: z.string().trim().min(1).max(64),
  triageColor: triageColorSchema,
  zone: z.string().trim().min(1).max(120),
  chiefComplaint: z.string().trim().max(500).optional(),
  age: z.string().trim().max(32).optional(),
  sex: patientSexSchema.optional(),
  vitalSigns: vitalSignsSchema.optional(),
});

export const updateHospitalCapacityRequestSchema = z.object({
  hospitals: z.array(hospitalCapacityEntrySchema),
});

export const transportPatientRequestSchema = z.object({
  transportStatus: transportStatusSchema,
  hospital: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(128).optional(),
  departed: z.boolean().optional(),
  arrived: z.boolean().optional(),
});

export const upsertInfraRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  infraType: infrastructureTypeSchema,
  address: infraAddressSchema,
  primaryContact: infraContactSchema,
  afterHoursContact: infraContactSchema.optional(),
  securityContact: infraContactSchema.optional(),
  occupancyLoad: z.number().int().nonnegative().optional(),
  operatingHours: z.string().trim().max(200).optional(),
  utilities: utilitiesInfoSchema.optional(),
  stagingAreas: z.array(stagingAreaSchema).optional(),
  accessPoints: z.array(accessPointSchema).optional(),
  notes: z.string().trim().max(4000).optional(),
  cleryActReporting: z.boolean().optional(),
  infraId: z.string().trim().max(128).optional(),
});

export const upsertProtocolRequestSchema = z.object({
  protocolId: z.string().trim().max(128).optional(),
  incidentType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  steps: z.array(infraProtocolStepSchema),
  contacts: z.array(infraContactSchema),
  resources: z.array(z.string().trim().max(200)).optional(),
});

export const requestInterpreterRequestSchema = z.object({
  incidentId: z.string().trim().min(1).max(128),
  language: bcp47Schema,
  languageDisplayName: z.string().trim().min(1).max(120),
  triggerReason: interpreterTriggerReasonSchema.optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  method: interpreterMethodSchema.optional(),
  serviceProvider: z.string().trim().max(120).optional(),
});

export const completeInterpreterRequestSchema = z.object({
  status: interpreterRequestStatusSchema,
  durationSeconds: z.number().nonnegative().optional(),
  callQuality: callQualitySchema.optional(),
  language: bcp47Schema.optional(),
  method: interpreterMethodSchema.optional(),
  incidentId: z.string().trim().max(128).optional(),
});

export const createEvidenceRequestSchema = z.object({
  incidentId: z.string().trim().min(1).max(128),
  evidenceType: evidenceTypeSchema,
  sourceMethod: evidenceSourceMethodSchema.optional(),
  originalFilename: z.string().trim().max(260).optional(),
  mimeType: z.string().trim().min(1).max(120),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  sha256Hash: z.string().trim().max(128).optional(),
  retentionDays: z.number().int().positive().optional(),
});

export const evidenceHoldRequestSchema = z.object({
  holdReason: z.string().trim().min(1).max(1000),
});

export const publicRecordsRequestSchema = z.object({
  requestorName: z.string().trim().min(1).max(200),
  requestorOrg: z.string().trim().max(200).optional(),
  requestorEmail: z.string().trim().email().max(254),
  dueDate: isoDatetimeSchema.optional(),
  redactionRequired: z.boolean().optional(),
  redactionReason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createAssessmentSessionRequestSchema = z.object({
  applicantId: z.string().trim().max(128).optional(),
  applicantName: z.string().trim().min(1).max(200),
  applicantEmail: z.string().trim().email().max(254),
  scenarioIds: z.array(z.string().trim().min(1).max(128)).min(1),
});

export const submitScenarioResultRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  agencyId: z.string().trim().min(1).max(128),
  scenarioId: z.string().trim().min(1).max(128),
  result: assessmentScenarioResultSchema,
});

export const createPublicEventRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  eventType: eventTypeSchema,
  venue: z.string().trim().max(200).optional(),
  address: eventAddressSchema.optional(),
  expectedAttendance: z.number().int().nonnegative().optional(),
  startAt: isoDatetimeSchema,
  endAt: isoDatetimeSchema,
  sourceUrl: z.string().trim().url().max(1024).optional(),
});

export const startCheckInTimerRequestSchema = z.object({
  unitId: z.string().trim().min(1).max(128),
  unitName: z.string().trim().min(1).max(200),
  durationMinutes: z.number().positive().max(480),
  incidentId: z.string().trim().max(128).optional(),
  incidentAddress: z.string().trim().max(400).optional(),
  escalationContacts: z.array(escalationContactSchema).optional(),
});

export const panicAlertRequestSchema = z.object({
  unitId: z.string().trim().min(1).max(128),
  unitName: z.string().trim().min(1).max(200),
  triggeredBy: panicTriggeredBySchema.optional(),
  lat: z.number().gte(-90).lte(90).optional(),
  lon: z.number().gte(-180).lte(180).optional(),
  incidentId: z.string().trim().max(128).optional(),
});

export const ingestSocialSignalRequestSchema = z.object({
  source: socialSourceSchema,
  rawText: z.string().trim().min(1).max(8000),
  location: socialLocationSchema.optional(),
  sourceUrl: z.string().trim().url().max(1024).optional(),
});

export const reviewSocialSignalRequestSchema = z.object({
  status: signalStatusSchema,
  linkedIncidentId: z.string().trim().max(128).optional(),
  dismissalReason: z.string().trim().max(1000).optional(),
});

/** Agency SAML SSO configure body (Cognito Identity Provider). */
export const configureAgencySsoBodySchema = z
  .object({
    metadataUrl: z.string().url().optional(),
    metadataFile: z.string().min(1).optional(),
    attributeMapping: z.record(z.string(), z.string()).optional(),
    idpIdentifiers: z.array(z.string().min(1)).max(50).optional(),
  })
  .refine((v) => Boolean(v.metadataUrl || v.metadataFile), {
    message: "Provide metadataUrl or metadataFile",
  });

export type ConfigureAgencySsoBody = z.infer<typeof configureAgencySsoBodySchema>;
