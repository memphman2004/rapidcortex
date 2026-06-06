import { z } from "zod";
import type { ProtocolGuidance } from "./protocol/types.js";
import type { TriageResult } from "./triage/triage.js";
import {
  AGENCY_ASSIGNABLE_ROLES,
  type AgencyAssignableRole,
  RAPID_CORTEX_ROLES,
  type RapidCortexRole,
} from "./auth/rapid-cortex-roles.js";

/** Canonical product role (`custom:role` / `UserContext.role`). */
export type UserRole = RapidCortexRole;

/** Agency-scoped roles (excludes RC-internal roles). */
export type AgencyRole = AgencyAssignableRole;

/** @deprecated Prefer `AgencyAssignableRole`; kept for transitional imports. */
export type FutureAgencyRole = "analyst" | "auditor";

/** Rapid Cortex internal full platform operator. */
export type PlatformPrincipalRole = "rcsuperadmin";

/** All assignable roles for agency admins (never RC-internal roles). */
export const AGENCY_ROLE_SCHEMA = z.enum(
  AGENCY_ASSIGNABLE_ROLES as unknown as [AgencyAssignableRole, ...AgencyAssignableRole[]],
);

/** Validates any known product role including RC-internal roles. */
export const USER_ROLE_SCHEMA = z.enum(RAPID_CORTEX_ROLES as unknown as [RapidCortexRole, ...RapidCortexRole[]]);

export type IncidentCategory =
  | "medical"
  | "fire"
  | "police"
  | "welfare_check"
  | "domestic_disturbance"
  | "unknown";

export type UrgencyLevel = "critical" | "high" | "moderate" | "low";

export type IncidentStatus = "active" | "in_progress" | "completed" | "archived";

export interface UserContext {
  userId: string;
  agencyId: string;
  role: UserRole;
  email: string;
  /** Present when Cognito `custom:status` is included in the ID token. */
  accountStatus?: string;
  /** Comma-separated extras (merged from `custom:dashboardAccess` / agency overrides sync). */
  dashboardAccess?: string;
  /** Cognito `custom:isSubscriber`, `custom:subStatus`, etc. drive commercial gating — see `@/session-product`. */
  isSubscriber?: boolean;
  subscriptionStatus?: string;
  planId?: string;
  /** `rapid_cortex_platform` | `rc_lite_api` | `hybrid` | `platform_internal` */
  customerType?: string;
  /** Product SKU slug (procurement naming; optional). */
  subscriptionProduct?: string;
  /** Raw `custom:entitlements` for API vs dashboard routing (comma-separated or JSON array string). */
  sessionEntitlements?: string;
  /** ISO-8601 UTC from `custom:pwdChangedAt` when emitted in the ID token. */
  passwordLastChangedAt?: string;
  /** Cognito `custom:pwdChangeReq` — user must rotate password before operational access. */
  passwordChangeRequired?: boolean | string;
  /** Cognito `custom:hospitalId` — hospital portal users only. */
  hospitalId?: string;
  /** Display name from `custom:firstName` / `custom:lastName` when present. */
  displayName?: string;
}

export interface Incident {
  incidentId: string;
  agencyId: string;
  title: string;
  /** Free-text caller / premise address line (optional). */
  callerAddressLine?: string | null;
  /** Indexed normalized address for prior-incident correlation (Dynamo GSI). */
  callerAddressNormalized?: string | null;
  /** Optional geocode for map pin (WGS84). */
  callerLocationLat?: number | null;
  callerLocationLng?: number | null;
  /** Provenance for coordinates when not from the incident’s own form. */
  callerLocationMapLabel?: string | null;
  category: IncidentCategory;
  urgency: UrgencyLevel;
  status: IncidentStatus;
  source: "demo" | "manual" | "stream" | "cad";
  /** CAD vendor key when `source` is `cad` or when incident is linked to CAD data. */
  cadSystem?: "motorola" | "tyler" | "centralsquare" | "hexagon" | "generic";
  /** CAD system incident / call identifier (not necessarily Rapid Cortex `incidentId`). */
  cadIncidentId?: string;
  /** Monotonic CAD update sequence for idempotent merges / conflict detection. */
  cadRevision?: number;
  /** Last vendor-provided revision number applied from CAD ingest (when vendors supply revisions). */
  cadVendorRevisionLast?: number;
  /** ISO-8601 — last successful sync or ingest from CAD. */
  cadLastSyncAt?: string;
  /** Last raw vendor payload (JSON string); treat as CJI. */
  cadRawPayload?: string;
  /** Vendor-reported incident lifecycle string (e.g. DISPATCHED, CLOSED). */
  cadStatus?: string;
  /** CAD priority code or label as received from the vendor. */
  cadPriority?: string;
  /** CAD nature / type code. */
  cadNatureCode?: string;
  /** CAD-formatted location string from the vendor. */
  cadLocation?: string;
  /** Assigned unit IDs from CAD. */
  cadUnits?: string[];
  /** CAD-reported coordinates when provided. */
  cadCoordinates?: { lat: number; lng: number };
  /** Idempotency key for CAD ingest (`integrationId:cadNumber:revision`). */
  cadDedupeKey?: string;
  /** CAD caller name when provided by vendor ingest (CJI — treat as sensitive). */
  cadCallerName?: string | null;
  /** Masked callback number for CAD-sourced incidents (never store full E.164 in clear text here). */
  cadCallerCallbackMasked?: string | null;
  /** Model-estimated confidence for latest triage; normalized 0–1 (UI may display as %). */
  confidence: number | null;
  escalationFlag: boolean;
  /** When the dispatcher used “Mark reviewed” on the AI panel (ISO-8601). */
  dispatcherReviewAcknowledgedAt?: string | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Short-lived coordination field: while set to a future ISO time, concurrent AI analysis
   * requests should back off (best-effort duplicate protection across Lambda invocations).
   */
  analysisInFlightUntil?: string | null;
  /**
   * F4 — auto-detected protocol recommendation from transcript + optional agency SOP doc.
   * Dismissal and overrides are dispatcher-facing guardrails, not medical determinations.
   */
  sopProtocolOverlay?: SopProtocolOverlayState | null;
  /** Labels the effective stack policy (e.g. `cjis-default-v1`) — see `config.retentionPolicyId` on agency. */
  retentionPolicyId?: string;
  /** ISO-8601 — automated purge is eligible at/after this time unless `legalHold` is true. */
  retentionExpiresAt?: string;
  /** When true, automated retention must not delete this row. */
  legalHold?: boolean;
  /** Human-readable reason for a legal hold. */
  legalHoldReason?: string | null;
  /** User id of admin who last toggled the legal hold. */
  legalHoldSetBy?: string | null;
  /** ISO-8601 */
  legalHoldSetAt?: string | null;
  /** Sparse GSI: fixed partition for scheduled retention scans (`RETENTION`). */
  retGsiPk?: string;
  /** Sort key: `${retentionExpiresAt}#...` (lexicographic for ISO timestamps). */
  retGsiSk?: string;
}

/** Persisted SOP-aware protocol suggestion for an incident (Dynamo map). */
export type SopProtocolOverlayState = {
  recommendedProtocolPackId: string | null;
  incidentTypeLabel: string;
  confidence: number;
  dismissedAt: string | null;
  manualProtocolPackId: string | null;
  completedStepIds: string[];
  segmentCountAtDetection: number;
  detectedAt: string;
};

/**
 * Single immutable utterance in the incident transcript chain.
 * Used for storage, replay, and protocol/AI inputs — keep field names stable for Dynamo and APIs.
 *
 * **`text` is always English (analysis-ready)** for the Rapid Cortex AI pipeline when multilingual
 * processing is enabled; `originalTranscript` preserves the caller/source language when different.
 */
export interface TranscriptSegment {
  segmentId: string;
  incidentId: string;
  agencyId: string;
  speaker: "caller" | "dispatcher" | "system" | "unknown";
  /** English text fed to analysis / protocol coaching (translated when source is non-English). */
  text: string;
  /** ISO-8601 timestamp (UTC recommended). */
  timestamp: string;
  /** Logical ordering within an incident (monotonic where provided). */
  segmentIndex?: number;
  callSessionId?: string;
  /** BCP-47 language tag (primary subtag, e.g. `es`, `zh`). */
  originalLanguage?: string;
  /** Normalized detector output (usually matches `originalLanguage`). */
  detectedLanguage?: string;
  languageConfidence?: number;
  /** Other likely languages from detection (for ambiguity / code-switching review). */
  languageAlternatives?: { language: string; confidence: number }[];
  /** Raw transcript in `originalLanguage` (may match `text` when English). */
  originalTranscript?: string;
  /** STT confidence for `originalTranscript` when distinct from `transcriptConfidence`. */
  originalTranscriptConfidence?: number;
  translatedEnglishTranscript?: string;
  translationConfidence?: number;
  sttProviderUsed?: string;
  /** Correlates STT work with provider-side ids (e.g. Amazon Transcribe `TranscriptionJobName`). */
  sttProviderRequestId?: string;
  sttModelUsed?: string;
  translationProviderUsed?: string;
  translationModelUsed?: string;
  transcriptConfidence?: number;
  isPartial?: boolean;
  isFinal?: boolean;
  needsInterpreterReview?: boolean;
  lowConfidence?: boolean;
  /** ISO-8601 when segment was last updated (partials finalized). */
  updatedAt?: string;
  chunkSource?: "manual" | "voice_upload" | "telephony_bridge" | "demo";
  startTimeMs?: number;
  endTimeMs?: number;
  sttLatencyMs?: number;
  translationLatencyMs?: number;
  /** True when a non-primary STT provider produced the segment. */
  sttFallbackUsed?: boolean;
  /** True when a non-primary translation provider produced English text. */
  translationFallbackUsed?: boolean;
  retentionPolicyId?: string;
  retentionExpiresAt?: string;
  legalHold?: boolean;
  legalHoldReason?: string | null;
  legalHoldSetBy?: string | null;
  legalHoldSetAt?: string | null;
  retGsiPk?: string;
  retGsiSk?: string;
}

/**
 * Live multilingual processing session for an incident (call-scoped; v1 uses incident as call container).
 */
export interface LanguageCallSession {
  sessionId: string;
  incidentId: string;
  agencyId: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "finalized" | "failed";
  detectedLanguage?: string;
  languageConfidence?: number;
  detectionMethod?: string;
  detectionTimestamp?: string;
  needsInterpreterReview?: boolean;
  lastErrorCode?: string;
  /** Count of transcript segments produced through this session. */
  segmentCount?: number;
  /** Last accepted audio chunk sequence (idempotency / ordering). */
  lastChunkSequence?: number;
  /** Set after a chunk is persisted — enables idempotent replay of the same `sequence`. */
  lastChunkSegmentId?: string;
  /**
   * Stack selection for text translation / optional TTS (from deployment env at session start).
   * Does not change live voice STT/translation chain behavior.
   */
  multilingualProviderMode?: "aws" | "google" | "auto";
  textTranslationBackend?: "aws" | "google";
}

/** Single entry in the ordered provider attempt chain (persisted for ops / debugging). */
export interface AiProviderAttemptRecord {
  tierIndex: number;
  providerKind: "openai" | "anthropic" | "bedrock" | "mock";
  adapterName: string;
  model: string;
  outcome: "success" | "failed";
  errorCode?: string;
  latencyMs?: number;
}

export type AiAnalysisStatus = "success" | "partial" | "failed";

export type AiAnalysisTriggerType = "manual" | "auto";

/** Distinguishes auxiliary analysis-table rows from primary dispatch AI runs. */
export type AnalysisRecordKind = "dispatch" | "triage";

/**
 * Persisted triage / decision-support snapshot from an AI provider run.
 * `confidence` is normalized **0.0–1.0** (not a percentage).
 */
export interface AIAnalysis {
  analysisId: string;
  incidentId: string;
  agencyId: string;
  /** When `triage`, clients should not treat this row as the primary dispatch AI analysis. */
  analysisRecordKind?: AnalysisRecordKind;
  /** F3 — structured non-emergency triage payload (present when `analysisRecordKind` is `triage`). */
  nonEmergencyTriage?: TriageResult;
  category: IncidentCategory;
  urgency: UrgencyLevel;
  confidence: number;
  nextQuestion: string;
  recommendedAction: string;
  summary: string;
  rationale: string;
  escalationFlag: boolean;
  /** Winning adapter id (e.g. `openai-primary`, `anthropic-secondary`). */
  provider: string;
  createdAt: string;
  /**
   * Pre-arrival protocol coach layer — phrases and escalation text originate only from
   * approved protocol packs, not from free-form model invention.
   */
  protocolGuidance?: ProtocolGuidance;
  /** Redundant display alias for `provider` when present (ingest / exports). */
  providerUsed?: string;
  modelUsed?: string;
  promptVersion?: string;
  analysisLatencyMs?: number;
  fallbackCount?: number;
  providerAttemptChain?: AiProviderAttemptRecord[];
  analysisStatus?: AiAnalysisStatus;
  failureCategory?: string;
  rawProviderResponseId?: string;
  /** ISO-8601; when absent, clients may treat `createdAt` as analysis time. */
  analyzedAt?: string;
  transcriptSegmentCountAtAnalysis?: number;
  triggerType?: AiAnalysisTriggerType;
  triggeredByUserId?: string;
  /** Transcript fingerprint (e.g. sha256 hex) used for skip / debounce decisions. */
  transcriptFingerprintAtAnalysis?: string;
  retentionPolicyId?: string;
  retentionExpiresAt?: string;
  legalHold?: boolean;
  legalHoldReason?: string | null;
  legalHoldSetBy?: string | null;
  legalHoldSetAt?: string | null;
  retGsiPk?: string;
  retGsiSk?: string;
}

/** Optional resource classification for audit queries and RBAC reviews. */
export type AuditResourceType =
  | "incident"
  | "transcript"
  | "analysis"
  | "user"
  | "agency"
  | "billing"
  | "integration"
  | "session"
  | "hospital_prealert"
  | "hospital_profile"
  | "hospital_capacity"
  | "mci_plan"
  | "api_key"
  | "call"
  | "network_policy"
  | "network_emergency_override"
  | "network_emergency_override_request"
  | "venue_facility"
  | "venue_camera_session"
  | "platform_notice"
  | "unknown";

/**
 * Canonical audit event labels written by the API today.
 * Additional `type` strings are allowed for forward-compatible clients.
 */
export type AuditEventType =
  | "analysis.created"
  | "analysis.failed"
  | "analysis.skipped"
  | "transcript.segment_added"
  | "incident.created"
  | (string & {});

/**
 * Append-only security / workflow audit record (one row per logical action).
 * Dynamo and list APIs must remain backward-compatible with existing `eventId` / `details` shape.
 */
export interface AuditEvent {
  eventId: string;
  agencyId: string;
  incidentId?: string;
  actorId?: string;
  type: AuditEventType;
  /** Structured payload; avoid storing raw PII or full transcripts unless policy requires it. */
  details: Record<string, unknown>;
  createdAt: string;
  /** Optional: normalized resource type for filtering (older rows may omit). */
  resourceType?: AuditResourceType;
  /** Optional: primary resource id (incidentId, userId, segmentId, etc.). */
  resourceId?: string;
  /** Optional: client IP for access reviews (omit in dev if unwanted). */
  ip?: string;
  /** Optional: client user-agent string. */
  userAgent?: string;
}
