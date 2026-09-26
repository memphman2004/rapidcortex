import type { z } from "zod";
import type {
  accessPointSchema,
  activateMciRequestSchema,
  addAddressHazardRequestSchema,
  addMciPatientRequestSchema,
  addressHazardSchema,
  addressHazardTypeSchema,
  addressIncidentSummarySchema,
  addressIntelligenceSchema,
  addressPrePlanSchema,
  altOutcomeRequestSchema,
  alternativeResourceSchema,
  alternativeResourceTypeSchema,
  alternativeResponseFlagSchema,
  alternativeResponseOutcomeSchema,
  alternativeResponseTypeSchema,
  assessmentDifficultySchema,
  assessmentRubricSchema,
  assessmentScenarioResultSchema,
  assessmentScenarioSchema,
  assessmentSessionSchema,
  assessmentStatusSchema,
  buildingInfoSchema,
  buildingTypeSchema,
  callQualitySchema,
  chainOfCustodyActionSchema,
  chainOfCustodyEntrySchema,
  checkInTimerSchema,
  checkInTimerStatusSchema,
  citizenAddressSchema,
  citizenLookupResultSchema,
  citizenMatchOnSchema,
  citizenProfileSchema,
  commitMutualAidRequestSchema,
  commitmentStatusSchema,
  committedResourceSchema,
  communicationNeedSchema,
  communicationNeedTypeSchema,
  communicationPreferredMethodSchema,
  completeInterpreterRequestSchema,
  coResponderStatusSchema,
  coResponderUnitSchema,
  createAssessmentSessionRequestSchema,
  createEvidenceRequestSchema,
  createMutualAidRequestSchema,
  createPublicEventRequestSchema,
  criticalInfrastructureSchema,
  depositIncidentIntelligenceRequestSchema,
  enrolledViaSchema,
  escalationContactMethodSchema,
  escalationContactSchema,
  escalationLevelSchema,
  evaluateAltResponseRequestSchema,
  eventTypeSchema,
  evidenceHoldRequestSchema,
  evidenceRecordSchema,
  evidenceSourceMethodSchema,
  evidenceStatusSchema,
  evidenceTypeSchema,
  expectedActionSchema,
  facilityTypeSchema,
  fireProtectionInfoSchema,
  floorPlanAnnotationSchema,
  floorPlanAnnotationTypeSchema,
  floorPlanSchema,
  floorPlanUploadUrlRequestSchema,
  hazardSeveritySchema,
  hazmatLocationSchema,
  hospitalCapacityEntrySchema,
  householdMemberSchema,
  impactLevelSchema,
  incidentProtocolSchema,
  infraContactSchema,
  infraProtocolStepSchema,
  infrastructureTypeSchema,
  ingestSocialSignalRequestSchema,
  interpreterMethodSchema,
  interpreterRequestSchema,
  interpreterRequestStatusSchema,
  interpreterTriggerReasonSchema,
  languageAccessRecordSchema,
  learningPatternSchema,
  learningPatternStatusSchema,
  mciCommandPatientSchema,
  mciEventSchema,
  mciSeveritySchema,
  mciStatusSchema,
  medicalFlagSchema,
  medicalSeveritySchema,
  mobilityStatusSchema,
  mutualAidPrioritySchema,
  mutualAidRequestSchema,
  panicAlertRequestSchema,
  panicAlertSchema,
  panicAlertStatusSchema,
  panicTriggeredBySchema,
  patternTypeSchema,
  petSchema,
  pirInsightSchema,
  prePlanContactSchema,
  publicEventSchema,
  publicEventStatusSchema,
  publicRecordsRequestRecordSchema,
  publicRecordsRequestSchema,
  publicRecordsStatusSchema,
  recommendationPrioritySchema,
  registerCitizenRequestSchema,
  requestInterpreterRequestSchema,
  resourceAvailabilityStatusSchema,
  resourceCommitmentSchema,
  resourceNeedSchema,
  resourceRequestStatusSchema,
  reviewSocialSignalRequestSchema,
  rubricCategorySchema,
  signalStatusSchema,
  signalUrgencySchema,
  socialSignalSchema,
  socialSignalTypeSchema,
  socialSourceSchema,
  staffingPrioritySchema,
  staffingRecommendationSchema,
  stagingAreaSchema,
  startCheckInTimerRequestSchema,
  submitScenarioResultRequestSchema,
  supervisorAltDecisionRequestSchema,
  supervisorAltDecisionSchema,
  surgeModelSchema,
  trainingRecommendationSchema,
  trainingRecommendationTypeSchema,
  transportPatientRequestSchema,
  transportStatusSchema,
  traumaLevelSchema,
  triageColorSchema,
  triageSummarySchema,
  updateCitizenRequestSchema,
  updateCommitmentStatusRequestSchema,
  updateHospitalCapacityRequestSchema,
  upsertInfraRequestSchema,
  upsertPrePlanRequestSchema,
  upsertProtocolRequestSchema,
  utilitiesInfoSchema,
  vitalSignsSchema,
} from "./schemas.js";

// ── Inferred enum / union types ──────────────────────────────────────────────

export type MobilityStatus = z.infer<typeof mobilityStatusSchema>;
export type EnrolledVia = z.infer<typeof enrolledViaSchema>;
export type BuildingType = z.infer<typeof buildingTypeSchema>;
export type MedicalSeverity = z.infer<typeof medicalSeveritySchema>;
export type CommunicationNeedType = z.infer<typeof communicationNeedTypeSchema>;
export type CommunicationPreferredMethod = z.infer<typeof communicationPreferredMethodSchema>;
export type CitizenMatchOn = z.infer<typeof citizenMatchOnSchema>;
export type AddressHazardType = z.infer<typeof addressHazardTypeSchema>;
export type HazardSeverity = z.infer<typeof hazardSeveritySchema>;
export type FacilityType = z.infer<typeof facilityTypeSchema>;
export type FloorPlanAnnotationType = z.infer<typeof floorPlanAnnotationTypeSchema>;
export type AlternativeResponseType = z.infer<typeof alternativeResponseTypeSchema>;
export type AlternativeResourceType = z.infer<typeof alternativeResourceTypeSchema>;
export type ResourceAvailabilityStatus = z.infer<typeof resourceAvailabilityStatusSchema>;
export type SupervisorAltDecision = z.infer<typeof supervisorAltDecisionSchema>;
export type AltResolution = z.infer<typeof alternativeResponseOutcomeSchema>["resolution"];
export type CoResponderStatus = z.infer<typeof coResponderStatusSchema>;
export type ResourceRequestStatus = z.infer<typeof resourceRequestStatusSchema>;
/** Mutual-aid priority 1–5 (renamed from Priority to avoid cad-mesh clash). */
export type MutualAidPriority = z.infer<typeof mutualAidPrioritySchema>;
export type CommitmentStatus = z.infer<typeof commitmentStatusSchema>;
export type TriageColor = z.infer<typeof triageColorSchema>;
export type MCIStatus = z.infer<typeof mciStatusSchema>;
export type MCISeverity = z.infer<typeof mciSeveritySchema>;
export type TransportStatus = z.infer<typeof transportStatusSchema>;
export type TraumaLevel = z.infer<typeof traumaLevelSchema>;
export type InfrastructureType = z.infer<typeof infrastructureTypeSchema>;
export type InterpreterMethod = z.infer<typeof interpreterMethodSchema>;
export type InterpreterRequestStatus = z.infer<typeof interpreterRequestStatusSchema>;
export type InterpreterTriggerReason = z.infer<typeof interpreterTriggerReasonSchema>;
export type CallQuality = z.infer<typeof callQualitySchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type EvidenceSourceMethod = z.infer<typeof evidenceSourceMethodSchema>;
export type ChainOfCustodyAction = z.infer<typeof chainOfCustodyActionSchema>;
export type PublicRecordsStatus = z.infer<typeof publicRecordsStatusSchema>;
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
export type AssessmentDifficulty = z.infer<typeof assessmentDifficultySchema>;
export type PatternType = z.infer<typeof patternTypeSchema>;
export type LearningPatternStatus = z.infer<typeof learningPatternStatusSchema>;
export type TrainingRecommendationType = z.infer<typeof trainingRecommendationTypeSchema>;
export type RecommendationPriority = z.infer<typeof recommendationPrioritySchema>;
export type ImpactLevel = z.infer<typeof impactLevelSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type PublicEventStatus = z.infer<typeof publicEventStatusSchema>;
export type StaffingPriority = z.infer<typeof staffingPrioritySchema>;
export type CheckInTimerStatus = z.infer<typeof checkInTimerStatusSchema>;
export type EscalationLevel = z.infer<typeof escalationLevelSchema>;
export type EscalationContactMethod = z.infer<typeof escalationContactMethodSchema>;
export type PanicTriggeredBy = z.infer<typeof panicTriggeredBySchema>;
export type PanicAlertStatus = z.infer<typeof panicAlertStatusSchema>;
export type SocialSource = z.infer<typeof socialSourceSchema>;
/** Social awareness signal class (renamed from SignalType to avoid rapid-iq clash). */
export type SocialSignalType = z.infer<typeof socialSignalTypeSchema>;
export type SignalStatus = z.infer<typeof signalStatusSchema>;
export type SignalUrgency = z.infer<typeof signalUrgencySchema>;

// ── Inferred entity types ────────────────────────────────────────────────────

export type CitizenAddress = z.infer<typeof citizenAddressSchema>;
export type MedicalFlag = z.infer<typeof medicalFlagSchema>;
export type CommunicationNeed = z.infer<typeof communicationNeedSchema>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export type Pet = z.infer<typeof petSchema>;
export type CitizenProfile = z.infer<typeof citizenProfileSchema>;
export type CitizenLookupResult = z.infer<typeof citizenLookupResultSchema>;

export type AddressIncidentSummary = z.infer<typeof addressIncidentSummarySchema>;
export type AddressHazard = z.infer<typeof addressHazardSchema>;
export type FloorPlanAnnotation = z.infer<typeof floorPlanAnnotationSchema>;
export type FloorPlan = z.infer<typeof floorPlanSchema>;
export type FireProtectionInfo = z.infer<typeof fireProtectionInfoSchema>;
export type PrePlanContact = z.infer<typeof prePlanContactSchema>;
export type HazmatLocation = z.infer<typeof hazmatLocationSchema>;
export type BuildingInfo = z.infer<typeof buildingInfoSchema>;
export type UtilitiesInfo = z.infer<typeof utilitiesInfoSchema>;
export type StagingArea = z.infer<typeof stagingAreaSchema>;
export type AddressPrePlan = z.infer<typeof addressPrePlanSchema>;
export type AddressIntelligence = z.infer<typeof addressIntelligenceSchema>;

export type AlternativeResource = z.infer<typeof alternativeResourceSchema>;
export type AlternativeResponseOutcome = z.infer<typeof alternativeResponseOutcomeSchema>;
export type AlternativeResponseFlag = z.infer<typeof alternativeResponseFlagSchema>;
export type CoResponderUnit = z.infer<typeof coResponderUnitSchema>;

export type ResourceNeed = z.infer<typeof resourceNeedSchema>;
export type CommittedResource = z.infer<typeof committedResourceSchema>;
export type ResourceCommitment = z.infer<typeof resourceCommitmentSchema>;
export type MutualAidRequest = z.infer<typeof mutualAidRequestSchema>;

export type TriageSummary = z.infer<typeof triageSummarySchema>;
export type VitalSigns = z.infer<typeof vitalSignsSchema>;
export type HospitalCapacityEntry = z.infer<typeof hospitalCapacityEntrySchema>;
export type MCIEvent = z.infer<typeof mciEventSchema>;
/** Feature-types `MCIPatient` — schema exported as mciCommandPatientSchema. */
export type MCIPatient = z.infer<typeof mciCommandPatientSchema>;

export type InfraContact = z.infer<typeof infraContactSchema>;
/** Feature-types `ProtocolStep` — schema exported as infraProtocolStepSchema. */
export type InfraProtocolStep = z.infer<typeof infraProtocolStepSchema>;
export type IncidentProtocol = z.infer<typeof incidentProtocolSchema>;
export type AccessPoint = z.infer<typeof accessPointSchema>;
export type CriticalInfrastructure = z.infer<typeof criticalInfrastructureSchema>;

export type InterpreterRequest = z.infer<typeof interpreterRequestSchema>;
export type LanguageAccessRecord = z.infer<typeof languageAccessRecordSchema>;

export type ChainOfCustodyEntry = z.infer<typeof chainOfCustodyEntrySchema>;
export type PublicRecordsRequest = z.infer<typeof publicRecordsRequestRecordSchema>;
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;

export type ExpectedAction = z.infer<typeof expectedActionSchema>;
export type RubricCategory = z.infer<typeof rubricCategorySchema>;
export type AssessmentRubric = z.infer<typeof assessmentRubricSchema>;
/** Feature-types `ScenarioResult` — schema exported as assessmentScenarioResultSchema. */
export type AssessmentScenarioResult = z.infer<typeof assessmentScenarioResultSchema>;
export type AssessmentScenario = z.infer<typeof assessmentScenarioSchema>;
export type AssessmentSession = z.infer<typeof assessmentSessionSchema>;

export type TrainingRecommendation = z.infer<typeof trainingRecommendationSchema>;
export type LearningPattern = z.infer<typeof learningPatternSchema>;
export type PIRInsight = z.infer<typeof pirInsightSchema>;

export type SurgeModel = z.infer<typeof surgeModelSchema>;
export type StaffingRecommendation = z.infer<typeof staffingRecommendationSchema>;
export type PublicEvent = z.infer<typeof publicEventSchema>;

export type EscalationContact = z.infer<typeof escalationContactSchema>;
export type CheckInTimer = z.infer<typeof checkInTimerSchema>;
export type PanicAlert = z.infer<typeof panicAlertSchema>;

export type SocialSignal = z.infer<typeof socialSignalSchema>;

// ── Inferred request types ───────────────────────────────────────────────────

export type RegisterCitizenRequest = z.infer<typeof registerCitizenRequestSchema>;
export type UpdateCitizenRequest = z.infer<typeof updateCitizenRequestSchema>;
export type DepositIncidentIntelligenceRequest = z.infer<typeof depositIncidentIntelligenceRequestSchema>;
export type AddAddressHazardRequest = z.infer<typeof addAddressHazardRequestSchema>;
export type UpsertPrePlanRequest = z.infer<typeof upsertPrePlanRequestSchema>;
export type FloorPlanUploadUrlRequest = z.infer<typeof floorPlanUploadUrlRequestSchema>;
export type EvaluateAltResponseRequest = z.infer<typeof evaluateAltResponseRequestSchema>;
export type SupervisorAltDecisionRequest = z.infer<typeof supervisorAltDecisionRequestSchema>;
export type AltOutcomeRequest = z.infer<typeof altOutcomeRequestSchema>;
export type CreateMutualAidRequest = z.infer<typeof createMutualAidRequestSchema>;
export type CommitMutualAidRequest = z.infer<typeof commitMutualAidRequestSchema>;
export type UpdateCommitmentStatusRequest = z.infer<typeof updateCommitmentStatusRequestSchema>;
export type ActivateMciRequest = z.infer<typeof activateMciRequestSchema>;
export type AddMciPatientRequest = z.infer<typeof addMciPatientRequestSchema>;
export type UpdateHospitalCapacityRequest = z.infer<typeof updateHospitalCapacityRequestSchema>;
export type TransportPatientRequest = z.infer<typeof transportPatientRequestSchema>;
export type UpsertInfraRequest = z.infer<typeof upsertInfraRequestSchema>;
export type UpsertProtocolRequest = z.infer<typeof upsertProtocolRequestSchema>;
export type RequestInterpreterRequest = z.infer<typeof requestInterpreterRequestSchema>;
export type CompleteInterpreterRequest = z.infer<typeof completeInterpreterRequestSchema>;
export type CreateEvidenceRequest = z.infer<typeof createEvidenceRequestSchema>;
export type EvidenceHoldRequest = z.infer<typeof evidenceHoldRequestSchema>;
export type PublicRecordsRequestBody = z.infer<typeof publicRecordsRequestSchema>;
export type CreateAssessmentSessionRequest = z.infer<typeof createAssessmentSessionRequestSchema>;
export type SubmitScenarioResultRequest = z.infer<typeof submitScenarioResultRequestSchema>;
export type CreatePublicEventRequest = z.infer<typeof createPublicEventRequestSchema>;
export type StartCheckInTimerRequest = z.infer<typeof startCheckInTimerRequestSchema>;
export type PanicAlertRequest = z.infer<typeof panicAlertRequestSchema>;
export type IngestSocialSignalRequest = z.infer<typeof ingestSocialSignalRequestSchema>;
export type ReviewSocialSignalRequest = z.infer<typeof reviewSocialSignalRequestSchema>;

// ── DynamoDB key helpers ─────────────────────────────────────────────────────

export const FEATURES_SK = {
  PROFILE: "PROFILE",
  ALT_RESPONSE: "ALT_RESPONSE",
} as const;

export function citizenPk(phoneE164: string): string {
  return `CITIZEN#${phoneE164}`;
}

export function citizenProfileSk(): string {
  return FEATURES_SK.PROFILE;
}

export function addressPk(geohash8: string): string {
  return `ADDRESS#${geohash8}`;
}

export function addressUnitSk(normalizedAddress: string): string {
  return `UNIT#${normalizedAddress}`;
}

export function agencyPk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

export function incidentPk(incidentId: string): string {
  return `INCIDENT#${incidentId}`;
}

export function altResponseSk(): string {
  return FEATURES_SK.ALT_RESPONSE;
}

export function coResponderSk(unitId: string): string {
  return `CORESPONDER#${unitId}`;
}

export function mutualAidRequestSk(requestId: string, createdAt: string): string {
  return `MAID_REQ#${requestId}#${createdAt}`;
}

export function mciEventSk(mciId: string): string {
  return `MCI#${mciId}`;
}

export function mciPatientPk(mciId: string): string {
  return `MCI#${mciId}`;
}

export function mciPatientSk(patientId: string): string {
  return `PATIENT#${patientId}`;
}

export function infraSk(infraId: string): string {
  return `INFRA#${infraId}`;
}

export function interpreterSk(requestId: string): string {
  return `INTERP#${requestId}`;
}

export function lepSk(year: number | string, month: string, recordId: string): string {
  return `LEP#${year}#${month}#${recordId}`;
}

export function evidenceSk(evidenceId: string): string {
  return `EVIDENCE#${evidenceId}`;
}

export function scenarioSk(scenarioId: string): string {
  return `SCENARIO#${scenarioId}`;
}

export function assessmentSessionSk(sessionId: string): string {
  return `SESSION#${sessionId}`;
}

export function patternSk(patternType: string, detectedAt: string): string {
  return `PATTERN#${patternType}#${detectedAt}`;
}

export function pirInsightSk(insightId: string): string {
  return `PIR_INSIGHT#${insightId}`;
}

export function publicEventSk(eventId: string): string {
  return `EVENT#${eventId}`;
}

export function checkInTimerSk(timerId: string): string {
  return `TIMER#${timerId}`;
}

export function panicAlertSk(alertId: string): string {
  return `PANIC#${alertId}`;
}

export function socialSignalSk(signalId: string): string {
  return `SIGNAL#${signalId}`;
}

export function statusGsiPk(status: string): string {
  return `STATUS#${status}`;
}

export function infraTypeGsiPk(infraType: string): string {
  return `TYPE#${infraType}`;
}
