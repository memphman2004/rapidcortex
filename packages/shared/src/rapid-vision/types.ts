/**
 * Rapid Vision™ data types.
 * Product name: Rapid Vision™ (formerly Rapid Cortex Connect).
 */

export const RAPID_VISION_PRODUCT_NAME = "Rapid Vision™";
export const RAPID_VISION_PRODUCT_NAME_ASCII = "Rapid Vision";

export type VisionProvider =
  | "rtsp"
  | "onvif"
  | "caller_video"
  | "verkada"
  | "axis"
  | "eagle_eye"
  | "municipal"
  | "drone"
  | "demo";

export type CameraType =
  | "doorbell"
  | "fixed_outdoor"
  | "fixed_indoor"
  | "ptz"
  | "drone"
  | "mobile"
  | "bodycam";

export type CameraCapability =
  | "live_stream"
  | "recorded_clips"
  | "ptz"
  | "audio"
  | "night_vision"
  | "motion_detection";

export type ConsentPolicy =
  | "ask_every_time"
  | "preauthorized_emergency"
  | "preauthorized_specific_types"
  | "recorded_clips_only"
  | "no_live_access"
  | "disabled";

export type CameraConnectionStatus = "online" | "offline" | "unknown";

export type VisionAccessState =
  | "AVAILABLE"
  | "CONSENT_REQUIRED"
  | "ACCESS_REQUESTED"
  | "AUTHORIZED"
  | "LIVE"
  | "ANALYZING"
  | "OBSERVATION_AVAILABLE"
  | "OWNER_DECLINED"
  | "ACCESS_EXPIRED"
  | "DEVICE_OFFLINE"
  | "PROVIDER_UNAVAILABLE"
  | "CAPABILITY_NOT_SUPPORTED"
  | "DEMO";

export type VisionSessionStatus = "pending" | "active" | "expired" | "revoked" | "declined";

export type AIAnalysisStatus = "not_started" | "active" | "paused" | "stopped";

export type VisionTranscriptStatus = "idle" | "active" | "stopped";

export type ObservationSource = "claude_vision" | "rekognition" | "correlation" | "demo";

export type ObservationConfidence = "LOW" | "MEDIUM" | "HIGH";

export type VisionVerificationStatus = "unverified" | "verified" | "rejected" | "inconclusive";

export type DetectionCategory =
  | "PERSON"
  | "PERSON_DOWN"
  | "FIGHT_OR_ALTERCATION"
  | "CROWD_FORMATION"
  | "CROWD_SURGE"
  | "RUNNING"
  | "RESTRICTED_AREA_ENTRY"
  | "VEHICLE"
  | "VEHICLE_DIRECTION"
  | "VEHICLE_COLOR"
  | "VEHICLE_TYPE"
  | "VISIBLE_SMOKE"
  | "VISIBLE_FIRE"
  | "ABANDONED_OBJECT"
  | "POTENTIAL_WEAPON"
  | "LICENSE_PLATE_CANDIDATE"
  | "PERSON_DESCRIPTION"
  | "UNUSUAL_MOVEMENT"
  | "NO_RELEVANT_ACTIVITY"
  | "SCENE_DESCRIPTION"
  | "DEMO";

export interface RecognitionLabel {
  name: string;
  confidence: number;
  instances: number;
}

export interface VisionCamera {
  cameraId: string;
  provider: VisionProvider;
  providerDeviceId: string;
  ownerId: string | null;
  agencyId: string;
  friendlyName: string;
  cameraType: CameraType;
  latitude: number;
  longitude: number;
  coverageAreaM: number;
  orientationDeg?: number;
  isPublic: boolean;
  isIndoor: boolean;
  capabilities: CameraCapability[];
  consentPolicy: ConsentPolicy;
  connectionStatus: CameraConnectionStatus;
  lastHealthCheck: string | null;
  kvsChannelName?: string | null;
  kvsStreamArn?: string | null;
  /** Proactive AI Scene Intelligence — watch this camera without an open incident. */
  aiMonitoringEnabled?: boolean;
  zoneLabel?: string;
  sceneCooldownSeconds?: number;
  sceneSensitivity?: "low" | "medium" | "high" | "maximum";
  createdAt: string;
  updatedAt: string;
}

export interface VisionCameraSearchResult extends VisionCamera {
  distanceMeters: number;
  accessState: VisionAccessState;
  sessionId?: string;
  relevanceRank: number;
}

export interface VisionSession {
  sessionId: string;
  incidentId: string;
  agencyId: string;
  cameraId: string;
  provider: VisionProvider;
  providerSessionId: string | null;
  kvsChannelName: string | null;
  kvsStreamArn: string | null;
  requestedBy: string;
  authorizedBy: "owner" | "agency_policy" | "demo";
  status: VisionSessionStatus;
  aiAnalysisStatus: AIAnalysisStatus;
  accessLevel: "live_stream" | "recorded_only";
  startedAt: string;
  expiresAt: string;
  lastAnalyzedAt?: string;
  revokedAt?: string;
  /** Live scene-audio transcript worker. Unset/idle until dispatcher starts it. */
  transcriptStatus?: VisionTranscriptStatus;
  transcriptStartedAt?: string;
  transcriptStartedBy?: string;
  transcriptStoppedAt?: string;
}

export interface VisionObservation {
  observationId: string;
  incidentId: string;
  agencyId: string;
  sessionId: string;
  cameraId: string;
  provider: VisionProvider;
  timestamp: string;
  writtenAt: string;
  source: ObservationSource;
  category: DetectionCategory | string;
  narrative: string;
  detectionLabels?: RecognitionLabel[];
  confidence: ObservationConfidence;
  correlatedEvidenceIds: string[];
  correlationSummary?: string;
  supportingFrameS3Key?: string;
  verificationStatus: VisionVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  sharedWithUserIds: string[];
  ttl: number;
}

export interface VisionIntelligenceFeed {
  incidentId: string;
  agencyId: string;
  activeSessions: VisionSession[];
  observations: VisionObservation[];
  unverifiedCount: number;
  verifiedCount: number;
  discoveredCameras: VisionCameraSearchResult[];
  lastUpdated: string;
}

export interface VisionTranscriptSegment {
  resultId: string;
  incidentId: string;
  agencyId: string;
  sessionId: string;
  cameraId: string;
  speakerLabel: string;
  transcript: string;
  isPartial: boolean;
  startTime: number;
  endTime: number;
  confidence: number;
  language: string;
  timestamp: string;
}

export interface VisionAgencySettings {
  agencyId: string;
  enabled: boolean;
  enabledProviders: VisionProvider[];
  enableCallerVideoAnalysis: boolean;
  cameraSearchRadiusMeters: number;
  defaultAccessDurationMinutes: number;
  aiAnalysisLevel: "NORMAL" | "ELEVATED" | "CRITICAL";
  enabledDetectionCategories: DetectionCategory[];
  retentionDays: number;
  enableResponderSharing: boolean;
  ownerConsentPolicy: ConsentPolicy;
  aiBudgetThresholdMonthlyUSD: number;
  aiWriterIntervalSeconds: number;
  /** AI Scene Intelligence (proactive camera alerts). Unset inherits feature flags. */
  sceneIntelEnabled?: boolean;
  sceneIntelMinSeverity?: "critical" | "high" | "medium" | "low";
  sceneIntelClaudeEnabled?: boolean;
  sceneIntelThumbnailsEnabled?: boolean;
  sceneIntelWsEnabled?: boolean;
  sceneIntelAudioEnabled?: boolean;
  sceneIntelSupervisorPushEnabled?: boolean;
  sceneIntelMotionSensitivity?: number;
  updatedAt: string;
  updatedBy: string;
}

export type VisionSceneEventType =
  | "FIGHT_OR_ALTERCATION"
  | "PERSON_DOWN"
  | "CROWD_FORMATION"
  | "FORCED_ENTRY"
  | "VEHICLE_COLLISION"
  | "PERSON_RUNNING"
  | "VISIBLE_WEAPON"
  | "SHOPLIFTING"
  | "MEDICAL_EMERGENCY"
  | "SUSPICIOUS_VEHICLE";

export type VisionSceneSeverity = "critical" | "high" | "medium" | "low";

export type VisionSceneAlertStatus = "active" | "dismissed" | "incident_created" | "expired";

export interface VisionSceneAlert {
  eventId: string;
  agencyId: string;
  cameraId: string;
  cameraName: string;
  zoneLabel: string;
  timestamp: string;
  eventType: VisionSceneEventType;
  category: DetectionCategory;
  severity: VisionSceneSeverity;
  status: VisionSceneAlertStatus;
  shortLabel: string;
  narrative: string;
  confidence: ObservationConfidence;
  detectionLabels: RecognitionLabel[];
  thumbnailS3Key?: string;
  thumbnailUrl?: string;
  motionScore?: number;
  incidentId?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  dismissReason?: "false_positive" | "already_handled" | "other";
  ttl: number;
}

export type VisionWebSocketEvent =
  | {
      type: "rapid-vision.observation.created";
      observation: VisionObservation;
      cameraName: string;
      distanceMeters?: number;
    }
  | {
      type: "rapid-vision.session.started";
      session: VisionSession;
      cameraName: string;
    }
  | {
      type: "rapid-vision.session.expiring";
      sessionId: string;
      incidentId: string;
      expiresInSeconds: number;
    }
  | {
      type: "rapid-vision.session.expired";
      sessionId: string;
      incidentId: string;
    }
  | {
      type: "rapid-vision.camera.discovered";
      camera: VisionCameraSearchResult;
    }
  | {
      type: "rapid-vision.observation.verified";
      observationId: string;
      incidentId: string;
      verifiedBy: string;
    }
  | {
      type: "rapid-vision.observation.rejected";
      observationId: string;
      incidentId: string;
    }
  | {
      type: "rapid-vision.observation.streaming.start";
      observationId: string;
      sessionId: string;
      incidentId: string;
      cameraName: string;
      timestamp: string;
    }
  | {
      type: "rapid-vision.observation.streaming.token";
      observationId: string;
      sessionId: string;
      incidentId: string;
      token: string;
    }
  | {
      type: "rapid-vision.observation.streaming.complete";
      observationId: string;
      sessionId: string;
      incidentId: string;
      observation: VisionObservation;
    }
  | {
      type: "rapid-vision.observation.streaming.abort";
      observationId: string;
      sessionId: string;
      incidentId?: string;
    }
  | {
      type: "rapid-vision.transcript.segment";
      segment: VisionTranscriptSegment;
      incidentId: string;
      sessionId: string;
    }
  | {
      type: "rapid-vision.scene.alert";
      alert: VisionSceneAlert;
    }
  | {
      type: "rapid-vision.scene.updated";
      alert: VisionSceneAlert;
    };

export interface UnsupportedCapabilityResult {
  supported: false;
  code: "UNSUPPORTED_PROVIDER_CAPABILITY";
  provider: VisionProvider;
  capability: string;
  message: string;
}

export type ProviderResult<T> = ({ supported: true } & T) | UnsupportedCapabilityResult;

export type VisionAuditAction =
  | "VISION_CAMERA_DISCOVERED"
  | "VISION_CONSENT_REQUESTED"
  | "VISION_CONSENT_GRANTED"
  | "VISION_CONSENT_DECLINED"
  | "VISION_SESSION_STARTED"
  | "VISION_SESSION_VIEWED"
  | "VISION_AI_ANALYSIS_STARTED"
  | "VISION_AI_ANALYSIS_STOPPED"
  | "VISION_OBSERVATION_CREATED"
  | "VISION_OBSERVATION_VERIFIED"
  | "VISION_OBSERVATION_REJECTED"
  | "VISION_OBSERVATION_SHARED"
  | "VISION_CLIP_VIEWED"
  | "VISION_ACCESS_REVOKED"
  | "VISION_SESSION_EXPIRED"
  | "VISION_TRANSCRIPT_STARTED"
  | "VISION_TRANSCRIPT_STOPPED"
  | "VISION_SCENE_ALERT_CREATED"
  | "VISION_SCENE_ALERT_DISMISSED"
  | "VISION_SCENE_ALERT_INCIDENT_CREATED";
