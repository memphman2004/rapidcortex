export type ComplianceKeyword = "STOP" | "START" | "HELP" | "NONE";

export interface AgencyKeyword {
  PK: string;
  SK: string;
  keyword: string;
  response: string;
  isActive: boolean;
  updatedAt: string;
}

export type MmsMediaItem = {
  url: string;
  contentType: string;
  fileSize?: number;
};

export type SmsInboundMessage = {
  originationNumber?: string;
  originationPhoneNumber?: string;
  destinationNumber?: string;
  destinationPhoneNumber?: string;
  messageBody?: string;
  messageKeyword?: string;
  inboundMessageId?: string;
  mediaItems?: MmsMediaItem[];
  media?: MmsMediaItem[];
};

export type SmsLexTurn = {
  messages: Array<{ contentType: string; content: string }>;
  sessionAttributes: Record<string, string>;
  intentName?: string;
  intentState?: string;
  dialogActionType?: string;
  sessionEnded: boolean;
};

export type SmsSessionRecord = {
  agencyId: string;
  sk: string;
  entityType: "call_assist_sms_session";
  phoneLast4: string;
  lastActivity: number;
  optedOut: boolean;
  optedOutAt?: string;
  firstSeen: string;
  messageCount: number;
  /** True after the SMS onboarding welcome has been delivered to this phone. */
  welcomeSent?: boolean;
  lastConfirmationNumber?: string;
  expiresAt: number;
};

export type SmsMediaType = "IMAGE" | "VIDEO" | "UNSUPPORTED";

export type ProcessedSmsMedia = {
  s3Key: string;
  s3Bucket: string;
  contentType: string;
  mediaType: SmsMediaType;
  fileSizeBytes: number;
  moderationPassed: boolean;
  moderationLabels: string[];
  sceneLabels: string[];
};

export type SmsMediaRecord = {
  agencyId: string;
  sk: string;
  entityType: "call_assist_sms_media";
  phoneE164: string;
  phoneLast4: string;
  msgId: string;
  receivedAt: string;
  s3Key: string;
  s3Bucket: string;
  contentType: string;
  mediaType: SmsMediaType;
  fileSizeBytes: number;
  moderationPassed: boolean;
  moderationLabels: string[];
  sceneLabels: string[];
  confirmationNumber?: string;
  expiresAt: number;
};
