import { createHash } from "node:crypto";

export type MediaSourceType =
  | "IP_CAMERA"
  | "DOORBELL"
  | "MOBILE_CALLER"
  | "DRONE"
  | "EXTERNAL_PLATFORM"
  | "WEBRTC_NATIVE";

export type CameraProtocol = "RTSP" | "ONVIF" | "WEBRTC" | "HLS";

export type AccessModel = "STANDING" | "ON_DEMAND" | "EMERGENCY_OVERRIDE";

export interface ApprovalContact {
  name: string;
  email: string;
  phone: string;
  notifyVia: Array<"EMAIL" | "SMS">;
}

export interface ConnectSource {
  pk: string;
  sk: "PROFILE";
  sourceId: string;
  agencyId: string;
  sourceType: MediaSourceType;
  protocol: CameraProtocol;
  label: string;
  address: string;
  addressHash: string;
  lat?: number;
  lng?: number;
  rtspUrl?: string;
  onvifHost?: string;
  credentialsSecretArn?: string;
  accessModel: AccessModel;
  approvalContact?: ApprovalContact;
  backupApprovalContact?: ApprovalContact;
  approvalTimeoutSeconds: number;
  timeoutFallback: "DENY" | "ESCALATE_BACKUP" | "AUTO_APPROVE";
  consentSignedAt?: string;
  consentSignedBy?: string;
  status: "ACTIVE" | "OFFLINE" | "DEGRADED" | "SUSPENDED";
  lastHealthCheckAt?: string;
  enrolledBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus =
  | "REQUESTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "DENIED"
  | "CLOSED"
  | "EXPIRED";

export interface ConnectAccessSession {
  pk: string;
  sk: "PROFILE";
  sessionId: string;
  incidentId: string;
  sourceId: string;
  agencyId: string;
  dispatcherId: string;
  dispatcherName: string;
  status: SessionStatus;
  accessModel: AccessModel;
  approvedBy?: string;
  approvedAt?: string;
  deniedAt?: string;
  deniedReason?: string;
  streamStartedAt?: string;
  streamEndedAt?: string;
  kvsChannelName?: string;
  requestedAt: string;
  ttl: number;
}

export interface ConnectAccessEvent {
  pk: string;
  sk: string;
  sessionId: string;
  incidentId: string;
  sourceId: string;
  sourceLabel: string;
  agencyId: string;
  dispatcherId: string;
  dispatcherName: string;
  accessModel: AccessModel;
  status: SessionStatus;
  approvedBy?: string;
  requestedAt: string;
  resolvedAt?: string;
  durationSeconds?: number;
}

export type EvidenceType =
  | "CALLER_PHOTO"
  | "CALLER_VIDEO"
  | "CALLER_LIVE_STREAM"
  | "DRONE_FEED"
  | "SUBMITTED_CLIP"
  | "SUBMITTED_DOCUMENT";

export interface ConnectEvidence {
  pk: string;
  sk: string;
  evidenceId: string;
  incidentId: string;
  agencyId: string;
  evidenceType: EvidenceType;
  s3Key?: string;
  sessionId?: string;
  submittedBy: string;
  submittedAt: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  geolocation?: { lat: number; lng: number; accuracy?: number };
  description?: string;
  retentionExpiresAt: string;
  exportedAt?: string;
  exportedBy?: string;
}

export type ConnectWebhookEvent =
  | "connect.source.online"
  | "connect.source.offline"
  | "connect.access.requested"
  | "connect.access.approved"
  | "connect.access.denied"
  | "connect.access.closed"
  | "connect.evidence.submitted"
  | "incident.connect_source_available";

export interface ConnectWebhookConfig {
  pk: string;
  sk: string;
  webhookId: string;
  agencyId: string;
  targetUrl: string;
  events: ConnectWebhookEvent[];
  signingSecretArn: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export interface RegisterSourceRequest {
  sourceType: MediaSourceType;
  protocol: CameraProtocol;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  rtspUrl?: string;
  onvifHost?: string;
  credentials?: { username: string; password: string };
  accessModel: AccessModel;
  approvalContact?: ApprovalContact;
  backupApprovalContact?: ApprovalContact;
  approvalTimeoutSeconds?: number;
  timeoutFallback?: ConnectSource["timeoutFallback"];
}

export interface RequestAccessRequest {
  incidentId: string;
  sourceId: string;
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashAddress(address: string): string {
  return createHash("sha256").update(normalizeAddress(address)).digest("hex");
}
