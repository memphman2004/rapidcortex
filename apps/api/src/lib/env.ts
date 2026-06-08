import type { SmsPrimaryProvider, SmsProviderMode } from "rapid-cortex-shared";
import { smsPrimaryProviderSchema, smsProviderModeSchema } from "rapid-cortex-shared";
import { hydrateLambdaEnvFromJson } from "./hydrateLambdaEnv";

hydrateLambdaEnvFromJson();

/** Feature flags default on when unset; pass `defaultWhenUnset: false` to opt out (e.g. CAD write-back). */
function featureEnabled(name: string, defaultWhenUnset = true): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return defaultWhenUnset;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function resolveTwilioSecretArn(): string {
  return (process.env.TWILIO_SECRET_ARN?.trim() || process.env.INCIDENT_MEDIA_TWILIO_SECRET_ARN?.trim() || "");
}

/**
 * SMS_PROVIDER wins when set. Otherwise preserve legacy incident-media toggles
 * (Twilio ARN vs SNS direct) before defaulting to auto-routing.
 */
function resolveSmsProviderMode(): SmsProviderMode {
  const raw = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
  const normalized = raw === "sns" ? "aws" : raw;
  const parsed = smsProviderModeSchema.safeParse(normalized);
  if (parsed.success) return parsed.data;
  if (process.env.INCIDENT_MEDIA_SMS_MOCK === "true" || process.env.MOCK_SMS_PROVIDER === "true") {
    return "mock";
  }
  const twilioArn = resolveTwilioSecretArn();
  if (twilioArn && process.env.INCIDENT_MEDIA_SNS_DIRECT !== "1") {
    return "twilio";
  }
  if (process.env.INCIDENT_MEDIA_SNS_DIRECT === "1") {
    return "aws";
  }
  return "auto";
}

function resolveSmsPrimaryProvider(): SmsPrimaryProvider {
  const raw = (process.env.SMS_PRIMARY_PROVIDER ?? "twilio").trim().toLowerCase();
  const p = smsPrimaryProviderSchema.safeParse(raw);
  if (p.success) return p.data;
  return "twilio";
}

export const env = {
  region: required("AWS_REGION"),
  deploymentStage: process.env.DEPLOYMENT_STAGE?.trim() || "dev",
  incidentsTable: required("INCIDENTS_TABLE"),
  transcriptsTable: required("TRANSCRIPTS_TABLE"),
  analysesTable: required("ANALYSES_TABLE"),
  auditTable: required("AUDIT_TABLE"),
  /** Immutable CJI deletion audit (optional in local; required for `retentionExecutor` in AWS). */
  dataDeletionAuditTable: process.env.DATA_DELETION_AUDIT_TABLE?.trim() ?? "",
  defaultRetentionPolicyId: process.env.DEFAULT_RETENTION_POLICY_ID?.trim() || "cjis-default-v1",
  /** CJIS-oriented defaults: incident 7y, transcript 3y, media 1y, analysis 3y (overridable per agency). */
  retentionIncidentDaysDefault: Math.max(
    1,
    Number.parseInt(process.env.RETENTION_INCIDENT_DAYS_DEFAULT ?? "2555", 10) || 2555,
  ),
  retentionTranscriptDaysDefault: Math.max(
    1,
    Number.parseInt(process.env.RETENTION_TRANSCRIPT_DAYS_DEFAULT ?? "1095", 10) || 1095,
  ),
  retentionMediaDaysDefault: Math.max(
    1,
    Number.parseInt(process.env.RETENTION_MEDIA_DAYS_DEFAULT ?? "365", 10) || 365,
  ),
  retentionAnalysisDaysDefault: Math.max(
    1,
    Number.parseInt(process.env.RETENTION_ANALYSIS_DAYS_DEFAULT ?? "1095", 10) || 1095,
  ),
  retentionPurgePageSize: Math.max(
    1,
    Math.min(100, Number.parseInt(process.env.RETENTION_PURGE_PAGE_SIZE ?? "25", 10) || 25),
  ),
  agenciesTable: required("AGENCIES_TABLE"),
  invitesTable: required("INVITES_TABLE"),
  /** Tenant access overrides (`access-overrides` table). Empty disables handlers (local/mock). */
  accessOverridesTable: process.env.ACCESS_OVERRIDES_TABLE?.trim() ?? "",
  networkEmergencyOverridesTable: process.env.NETWORK_EMERGENCY_OVERRIDES_TABLE?.trim() ?? "",
  agencyNetworkPolicySnsTopicArn: process.env.AGENCY_NETWORK_POLICY_SNS_TOPIC_ARN?.trim() ?? "",
  wafWebAclArn: process.env.WAF_WEB_ACL_ARN?.trim() ?? "",
  wafScope: process.env.WAF_SCOPE?.trim() || "REGIONAL",
  /** When false (default), IP/shift enforcement in `getUserContext` is skipped (local tests, gradual rollout). */
  networkAccessEnforcement: process.env.NETWORK_ACCESS_ENFORCEMENT === "true",
  /** Agency API clients (`api-clients` table). Empty disables external `/api/v1` except token errors. */
  apiClientsTable: process.env.API_CLIENTS_TABLE?.trim() ?? "",
  /** Outbound webhooks configuration (`webhooks` table). */
  webhooksTable: process.env.WEBHOOKS_TABLE?.trim() ?? "",
  /** Rate counters for external API (per client / category / minute). */
  externalApiRateLimitsTable: process.env.EXTERNAL_API_RATE_LIMITS_TABLE?.trim() ?? "",
  /** RC Lite `rclite_*` hashed API keys (separate from OAuth `/api/v1`). */
  rcLiteEnabled: process.env.RC_LITE_ENABLED === "true",
  rcLiteApiKeysTable: process.env.RC_LITE_API_KEYS_TABLE?.trim() ?? "",
  rcLiteRateLimitTable: process.env.RC_LITE_RATE_LIMIT_TABLE?.trim() ?? "",
  rcLiteUsageTable: process.env.RC_LITE_USAGE_TABLE?.trim() ?? "",
  rcLiteOverdueSuspendDays: Number.parseInt(process.env.RC_LITE_OVERDUE_SUSPEND_DAYS ?? "45", 10) || 45,
  /** Secrets Manager ARN holding the JWT signing secret for agency API access tokens. */
  externalApiJwtSecretArn: process.env.EXTERNAL_API_JWT_SECRET_ARN?.trim() ?? "",
  /** Optional Secrets Manager ARN for loading a dedicated webhook encryption passphrase. */
  externalApiEncryptionKeyArn: process.env.EXTERNAL_API_ENCRYPTION_KEY_ARN?.trim() ?? "",
  /**
   * Dev/test fallback when `externalApiJwtSecretArn` is unset (never set in production templates).
   * Prefer Secrets Manager in AWS.
   */
  externalApiJwtSecretInline: process.env.EXTERNAL_API_JWT_SECRET?.trim() ?? "",
  /** 32+ char key for encrypting webhook signing secrets at rest (or dev inline). */
  externalApiEncryptionKeyInline: process.env.EXTERNAL_API_ENCRYPTION_KEY?.trim() ?? "",
  /** Dry-run external calls (no outbound webhook HTTP). */
  externalApiMock: process.env.EXTERNAL_API_MOCK === "true",
  billingProfilesTable: process.env.BILLING_PROFILES_TABLE?.trim() ?? "",
  billingWebhookEventsTable: process.env.BILLING_WEBHOOK_EVENTS_TABLE?.trim() ?? "",
  assetsBucket: required("ASSETS_BUCKET"),
  /** Optional — required for multilingual voice session + audio chunk routes. */
  languageSessionsTable: process.env.LANGUAGE_SESSIONS_TABLE?.trim() ?? "",
  /**
   * Optional agency SOP: target lifecycle for transcript data in days (set via stack parameter
   * `TranscriptRetentionPolicyDays`). No automatic purge; used for admin/compliance surfacing and ops.
   */
  transcriptRetentionPolicyDays: process.env.TRANSCRIPT_RETENTION_POLICY_DAYS?.trim() ?? "",
  /**
   * When > 0, append transcript POST triggers analysis every N segments (same agency/auth as caller).
   * Set to 0 to disable (default).
   */
  autoAnalyzeEveryNSegments: Math.max(
    0,
    Number.parseInt(process.env.AUTO_ANALYZE_EVERY_N_SEGMENTS ?? "0", 10) || 0,
  ),
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID?.trim() ?? "",
  /** Caller Video Assist (SMS + WebRTC) — empty disables video-assist HTTP handlers at runtime. */
  videoAssistTable: process.env.VIDEO_ASSIST_TABLE?.trim() ?? "",
  videoAssistPublicBaseUrl: process.env.VIDEO_ASSIST_PUBLIC_BASE_URL?.trim() ?? "",
  /** Live video V2 (tokenized caller link + dispatcher viewer). */
  enableLiveVideo: featureEnabled("ENABLE_LIVE_VIDEO"),
  liveVideoSessionsTable: process.env.LIVE_VIDEO_SESSIONS_TABLE?.trim() ?? "",
  liveVideoPublicBaseUrl: process.env.LIVE_VIDEO_PUBLIC_BASE_URL?.trim() ?? "",
  liveVideoSessionTtlSeconds: Math.max(
    120,
    Number.parseInt(process.env.LIVE_VIDEO_SESSION_TTL_SECONDS ?? "1800", 10) || 1800,
  ),
  liveVideoMaxDurationSeconds: Math.max(
    120,
    Number.parseInt(process.env.LIVE_VIDEO_MAX_DURATION_SECONDS ?? "900", 10) || 900,
  ),
  liveVideoHeartbeatTimeoutSeconds: Math.max(
    20,
    Number.parseInt(process.env.LIVE_VIDEO_HEARTBEAT_TIMEOUT_SECONDS ?? "45", 10) || 45,
  ),
  webrtcTurnSecretArn: process.env.WEBRTC_TURN_SECRET_ARN?.trim() ?? "",
  /**
   * IAM role assumed by the API to issue scoped STS credentials for KVS WebRTC in the browser.
   * When unset, live video uses legacy peer signaling via DynamoDB.
   */
  liveVideoKvsTokenRoleArn: process.env.LIVE_VIDEO_KVS_TOKEN_ROLE_ARN?.trim() ?? "",
  /**
   * Default **live + storage**: create a Kinesis video stream per session alongside the signaling channel.
   * Set `LIVE_VIDEO_STORAGE_MODE=off` to live-only (no `CreateStream`).
   */
  liveVideoStorageMode: (() => {
    const m = process.env.LIVE_VIDEO_STORAGE_MODE?.trim().toLowerCase() ?? "";
    if (m === "off" || m === "false" || m === "0" || m === "none") return "off" as const;
    if (m === "kvs" || m === "kvs-ingestion") return "kvs-ingestion" as const;
    return "kvs-ingestion" as const;
  })(),
  /** Data retention for the optional Kinesis **video** stream (hours). Min 1 when storage is used. */
  liveVideoKvsStreamRetentionHours: Math.max(
    1,
    Number.parseInt(process.env.LIVE_VIDEO_KVS_DATA_RETENTION_HOURS ?? "24", 10) || 24,
  ),
  /**
   * When true, calls UpdateMediaStorageConfiguration to attach the stream to the signaling channel.
   * AWS: this disables direct master/viewer on that channel; requires JoinStorageSession clients.
   * Default false so standard WebRTC master/viewer live video keeps working.
   */
  liveVideoKvsStorageAttachToChannel: process.env.LIVE_VIDEO_KVS_STORAGE_ATTACH_TO_CHANNEL === "true",
  kvsWebrtcTagApp: process.env.KVS_WEBRTC_TAG_APP?.trim() || "rapid-cortex",
  kvsWebrtcTagEnvironment: process.env.KVS_WEBRTC_TAG_ENV?.trim() || process.env.DEPLOYMENT_STAGE?.trim() || "dev",
  /** Silent Text (SMS + web chat) — empty disables silent-text HTTP handlers at runtime. */
  silentTextTable: process.env.SILENT_TEXT_TABLE?.trim() ?? "",
  silentTextPublicBaseUrl: process.env.SILENT_TEXT_PUBLIC_BASE_URL?.trim() ?? "",
  /** Pinpoint — caller GPS SMS links; empty table disables handlers. */
  pinpointLinksTable: process.env.PINPOINT_LINKS_TABLE?.trim() ?? "",
  pinpointPublicBaseUrl: process.env.PINPOINT_PUBLIC_BASE_URL?.trim() ?? "",
  pinpointSmsMock: process.env.PINPOINT_SMS_MOCK === "true",
  enablePinpoint: featureEnabled("ENABLE_PINPOINT"),
  /** Surge — duplicate-call clusters; empty table disables handlers. */
  surgeClustersTable: process.env.SURGE_CLUSTERS_TABLE?.trim() ?? "",
  enableSurge: featureEnabled("ENABLE_SURGE"),
  /** Rapid Cortex Connect — Ring integration (empty table names disable Ring HTTP handlers). */
  enableConnectRing: featureEnabled("ENABLE_CONNECT_RING"),
  ringAccountsTable: process.env.RING_TABLE_ACCOUNTS?.trim() ?? "",
  ringDevicesTable: process.env.RING_TABLE_DEVICES?.trim() ?? "",
  ringRequestsTable: process.env.RING_TABLE_REQUESTS?.trim() ?? "",
  ringSessionsTable: process.env.RING_TABLE_SESSIONS?.trim() ?? "",
  ringCredentialsSecretArn:
    process.env.RING_CREDENTIALS_SECRET_ARN?.trim() ||
    process.env.RING_PARTNER_TOKEN_SECRET_ARN?.trim() ||
    "",
  ringPublicApiBaseUrl:
    process.env.RING_PUBLIC_API_BASE_URL?.trim() || "https://api.rapidcortex.us",
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY?.trim() ?? "",
  /** Automated QA scoring (F1) — empty table names disable QA HTTP handlers at runtime. */
  qaSessionsTable: process.env.QA_SESSIONS_TABLE?.trim() ?? "",
  qaTemplatesTable: process.env.QA_TEMPLATES_TABLE?.trim() ?? "",
  qaScorecardsTable: process.env.QA_SCORECARDS_TABLE?.trim() ?? "",
  coachingNotesTable: process.env.COACHING_NOTES_TABLE?.trim() ?? "",
  incidentTimelineTable: process.env.INCIDENT_TIMELINE_TABLE?.trim() ?? "",
  /** Emergency Connect — hospital pre-arrival alerts (optional tables). */
  enableEmergencyConnect: featureEnabled("ENABLE_EMERGENCY_CONNECT"),
  hospitalPreAlertsTable: process.env.HOSPITAL_PREALERTS_TABLE?.trim() ?? "",
  hospitalProfilesTable: process.env.HOSPITAL_PROFILES_TABLE?.trim() ?? "",
  emergencyConnectMock: process.env.EMERGENCY_CONNECT_MOCK === "true",
  emergencyConnectSeedDemo: process.env.EMERGENCY_CONNECT_SEED_DEMO === "true",
  /** Hospital routing — live capacity, diversion status, transport recommendations. */
  enableHospitalRouting: featureEnabled("ENABLE_HOSPITAL_ROUTING"),
  hospitalCapacityTable: process.env.HOSPITAL_CAPACITY_TABLE?.trim() ?? "",
  hospitalRoutingMock: process.env.HOSPITAL_ROUTING_MOCK === "true",
  hospitalRoutingSeedDemo: process.env.HOSPITAL_ROUTING_SEED_DEMO === "true",
  slaBacklogSnapshotsTable: process.env.SLA_BACKLOG_SNAPSHOTS_TABLE?.trim() ?? "",
  warRoomsTable: process.env.WAR_ROOMS_TABLE?.trim() ?? "",
  warRoomMessagesTable: process.env.WAR_ROOM_MESSAGES_TABLE?.trim() ?? "",
  stakeholderPagesTable: process.env.STAKEHOLDER_PAGES_TABLE?.trim() ?? "",
  postIncidentReviewsTable: process.env.POST_INCIDENT_REVIEWS_TABLE?.trim() ?? "",
  agencyReportsTable: process.env.AGENCY_REPORTS_TABLE?.trim() ?? "",
  enableQaScoring: featureEnabled("ENABLE_QA_SCORING"),
  /** When true with ENABLE_QA_SCORING, successful incident analysis triggers QA scoring for draft/failed sessions on that incident. */
  enableQaScoreAfterAnalysis: featureEnabled("ENABLE_QA_SCORE_AFTER_ANALYSIS"),
  qaScoringMock: process.env.QA_SCORING_MOCK === "true",
  /** Bedrock foundation model id for structured QA JSON (e.g. anthropic.claude-3-5-haiku-20241022-v1:0). */
  qaBedrockModelId: process.env.QA_BEDROCK_MODEL_ID?.trim() ?? "",
  /** F2 caller media — empty table disables incident media HTTP handlers. */
  incidentMediaTable: process.env.INCIDENT_MEDIA_TABLE?.trim() ?? "",
  enableIncidentMedia: featureEnabled("ENABLE_INCIDENT_MEDIA"),
  incidentMediaPublicBaseUrl: process.env.INCIDENT_MEDIA_PUBLIC_BASE_URL?.trim() ?? "",
  incidentMediaTokenTtlMinutes: Math.max(
    15,
    Number.parseInt(process.env.INCIDENT_MEDIA_TOKEN_TTL_MINUTES ?? "120", 10) || 120,
  ),
  incidentMediaUploadUrlTtlSeconds: Math.max(
    60,
    Number.parseInt(process.env.INCIDENT_MEDIA_UPLOAD_URL_TTL_SECONDS ?? "900", 10) || 900,
  ),
  incidentMediaMaxUploadBytes: Math.max(
    1024,
    Number.parseInt(process.env.INCIDENT_MEDIA_MAX_UPLOAD_BYTES ?? `${50 * 1024 * 1024}`, 10) ||
      50 * 1024 * 1024,
  ),
  incidentMediaSnsDirect: process.env.INCIDENT_MEDIA_SNS_DIRECT === "1",
  /** Prefer TWILIO_SECRET_ARN when set (ops naming); falls back to INCIDENT_MEDIA_TWILIO_SECRET_ARN. */
  incidentMediaTwilioSecretArn: resolveTwilioSecretArn(),
  incidentMediaSmsMock: process.env.INCIDENT_MEDIA_SMS_MOCK === "true",
  smsProvider: resolveSmsProviderMode(),
  /** In `auto` mode, which provider to try first; secondary is the other. */
  smsPrimaryProvider: resolveSmsPrimaryProvider(),
  mockSmsProvider: process.env.MOCK_SMS_PROVIDER === "true",
  awsSmsRegion: process.env.AWS_SMS_REGION?.trim() ?? "",
  awsSmsUseSimulator: process.env.AWS_SMS_USE_SIMULATOR === "true",
  /** Non-secret AWS SMS / Pinpoint config (set in template; not credentials). */
  awsSmsConfigurationSetName: process.env.AWS_SMS_CONFIGURATION_SET_NAME?.trim() ?? "",
  awsSmsPoolId: process.env.AWS_SMS_POOL_ID?.trim() ?? "",
  /** When >0, overrides INCIDENT_MEDIA_TOKEN_TTL_MINUTES for upload-token expiry. */
  mediaUploadTokenTtlSeconds: Math.max(
    0,
    Number.parseInt(process.env.MEDIA_UPLOAD_TOKEN_TTL_SECONDS ?? "0", 10) || 0,
  ),
  /** F4 — SOP-aware protocol surfacing (also controls upload-url handler). */
  enableSopProtocolAi: featureEnabled("ENABLE_SOP_PROTOCOL_AI"),
  sopDetectEveryNSegments: Math.max(
    0,
    Number.parseInt(process.env.SOP_DETECT_EVERY_N_SEGMENTS ?? "0", 10) || 0,
  ),
  sopDetectionMock: process.env.SOP_DETECTION_MOCK === "true",
  sopUploadUrlTtlSeconds: Math.max(
    60,
    Number.parseInt(process.env.SOP_UPLOAD_URL_TTL_SECONDS ?? "900", 10) || 900,
  ),
  /** F3 — non-emergency triage rows in analyses table. */
  enableNonEmergencyTriage: featureEnabled("ENABLE_NON_EMERGENCY_TRIAGE"),
  triageDetectEveryNSegments: Math.max(
    0,
    Number.parseInt(process.env.TRIAGE_DETECT_EVERY_N_SEGMENTS ?? "0", 10) || 0,
  ),
  triageMock: process.env.TRIAGE_MOCK === "true",
  /** F5 — supervisor-only trauma keyword flags. */
  enableDispatcherWellness: featureEnabled("ENABLE_DISPATCHER_WELLNESS"),
  traumaFlagsTable: process.env.TRAUMA_FLAGS_TABLE?.trim() ?? "",
  enableCallerCard: featureEnabled("ENABLE_CALLER_CARD"),
  premiseNotesTable: process.env.PREMISE_NOTES_TABLE?.trim() ?? "",
  dispatcherCoachingNotesTable: process.env.DISPATCHER_COACHING_NOTES_TABLE?.trim() ?? "",
  incidentSharesTable: process.env.INCIDENT_SHARES_TABLE?.trim() ?? "",
  agencySharePartnersTable: process.env.AGENCY_SHARE_PARTNERS_TABLE?.trim() ?? "",
  enableCrossJurisdictionShares: featureEnabled("ENABLE_CROSS_JURISDICTION_SHARES"),
  analyticsCachePrefix: process.env.ANALYTICS_CACHE_PREFIX?.trim() || "analytics/v1",
  /**
   * Option 1 desktop (macOS) — object key inside `ASSETS_BUCKET` for the signed/notarized DMG.
   * When empty, admin download API reports `available: false` (no presigned URL).
   */
  desktopMacosS3Key: process.env.DESKTOP_MACOS_S3_KEY?.trim() ?? "",
  desktopMacosVersion: process.env.DESKTOP_MACOS_VERSION?.trim() || "1.0.0",
  desktopMacosReleasedAt: process.env.DESKTOP_MACOS_RELEASED_AT?.trim() ?? "",
  desktopMacosMinOs: process.env.DESKTOP_MACOS_MIN_OS?.trim() || "13.0",
  desktopMacosSha256: process.env.DESKTOP_MACOS_SHA256?.trim() ?? "",
  desktopMacosFileBytes: Math.max(
    0,
    Number.parseInt(process.env.DESKTOP_MACOS_FILE_BYTES ?? "0", 10) || 0,
  ),
  desktopMacosArtifactName: process.env.DESKTOP_MACOS_ARTIFACT_NAME?.trim() || "RapidCortex-1.0.0.dmg",
  /** Windows installer key in `ASSETS_BUCKET` (e.g. desktop/releases/RapidCortexSetup.exe). */
  desktopWindowsS3Key: process.env.DESKTOP_WINDOWS_S3_KEY?.trim() ?? "",
  desktopWindowsVersion: process.env.DESKTOP_WINDOWS_VERSION?.trim() || "1.0.0",
  desktopWindowsReleasedAt: process.env.DESKTOP_WINDOWS_RELEASED_AT?.trim() ?? "",
  desktopWindowsMinOs: process.env.DESKTOP_WINDOWS_MIN_OS?.trim() || "Windows 10 22H2",
  desktopWindowsSha256: process.env.DESKTOP_WINDOWS_SHA256?.trim() ?? "",
  desktopWindowsFileBytes: Math.max(
    0,
    Number.parseInt(process.env.DESKTOP_WINDOWS_FILE_BYTES ?? "0", 10) || 0,
  ),
  desktopWindowsArtifactName: process.env.DESKTOP_WINDOWS_ARTIFACT_NAME?.trim() || "RapidCortexSetup.exe",
  desktopDownloadUrlTtlSeconds: Math.min(
    3600,
    Math.max(60, Number.parseInt(process.env.DESKTOP_DOWNLOAD_URL_TTL_SECONDS ?? "300", 10) || 300),
  ),
  monetizationPlansTable: process.env.MONETIZATION_PLANS_TABLE?.trim() ?? "",
  monetizationAddOnsTable: process.env.MONETIZATION_ADDONS_TABLE?.trim() ?? "",
  agencySubscriptionsTable: process.env.AGENCY_SUBSCRIPTIONS_TABLE?.trim() ?? "",
  usageMetersTable: process.env.USAGE_METERS_TABLE?.trim() ?? "",
  monetizationInvoicesTable: process.env.MONETIZATION_INVOICES_TABLE?.trim() ?? "",
  billingAuditEventsTable: process.env.BILLING_AUDIT_EVENTS_TABLE?.trim() ?? "",
  salesLeadsTable: process.env.SALES_LEADS_TABLE?.trim() ?? "",
  /** Ops SNS (e.g. `OpsAlertsTopic`) — empty skips SNS publish on contact-sales. */
  opsSnsTopicArn: process.env.OPS_ALERTS_TOPIC_ARN?.trim() ?? "",
  /** Verified SES From address for contact-sales; empty skips SES (SNS may still fire). */
  contactFromEmail: process.env.CONTACT_FROM_EMAIL?.trim() ?? "",
  customersTable: process.env.CUSTOMERS_TABLE?.trim() ?? "",
  serviceCatalogTable: process.env.SERVICE_CATALOG_TABLE?.trim() ?? "",
  invoicesTable: process.env.INVOICES_TABLE?.trim() ?? "",
  invoiceItemsTable: process.env.INVOICE_ITEMS_TABLE?.trim() ?? "",
  billingSchedulesTable: process.env.BILLING_SCHEDULES_TABLE?.trim() ?? "",
  paymentRecordsTable: process.env.PAYMENT_RECORDS_TABLE?.trim() ?? "",
  billingAuditLogTable: process.env.BILLING_AUDIT_LOG_TABLE?.trim() ?? "",
  billingInvoicesBucket: process.env.BILLING_INVOICES_BUCKET?.trim() ?? "",
  billingPosBucket: process.env.BILLING_POS_BUCKET?.trim() ?? "",
  billingPaymentInstructionsSecretArn:
    process.env.BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN?.trim() ?? "",
  /**
   * NOT USED at runtime. Billing email sending goes through Lambda IAM role + AWS SES SDK
   * (BillingEmailSender) — no SMTP credentials are ever read. The secret
   * `rapid-cortex/billing/ses-credentials` is retained as a placeholder for a possible future
   * SMTP fallback path. If you remove the secret, also delete this field, the matching SAM
   * parameter (`BillingSesCredentialsSecretArn` in `nested/data-layer-sam.yaml`), and the export
   * in `scripts/env-api-dev.sh`. Do not populate the secret in dev unless wiring SMTP.
   */
  billingSesCredentialsSecretArn:
    process.env.BILLING_SES_CREDENTIALS_SECRET_ARN?.trim() ?? "",
  billingSesSenderEmail: process.env.BILLING_SES_SENDER_EMAIL?.trim() ?? "",
  /**
   * Origin of the public marketing site (absolute logo URLs in HTML email, etc.).
   * Aligns with web `NEXT_PUBLIC_SITE_URL`; defaults to https://www.rapidcortex.us
   */
  publicMarketingSiteOrigin: (() => {
    const DEFAULT = "https://www.rapidcortex.us";
    const raw =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
      process.env.PUBLIC_MARKETING_SITE_URL?.trim() ??
      "";
    if (!raw) return DEFAULT;
    try {
      return new URL(raw).origin;
    } catch {
      return DEFAULT;
    }
  })(),
  /** Cortex SEO Intelligence — empty disables SEO HTTP handlers at runtime. */
  seoIntelligenceTable: process.env.SEO_INTELLIGENCE_TABLE?.trim() ?? "",
  seoToolEnabled: process.env.SEO_TOOL_ENABLED !== "false",
  seoAutoScanEnabled: process.env.SEO_AUTO_SCAN_ENABLED === "true",
  seoAiSuggestionsEnabled: process.env.SEO_AI_SUGGESTIONS_ENABLED !== "false",
  seoMaxFetchBytes: Math.min(
    5_000_000,
    Math.max(50_000, Number.parseInt(process.env.SEO_MAX_FETCH_BYTES ?? "2000000", 10) || 2_000_000),
  ),
  seoFetchTimeoutMs: Math.min(
    60_000,
    Math.max(3000, Number.parseInt(process.env.SEO_FETCH_TIMEOUT_MS ?? "15000", 10) || 15_000),
  ),
  seoMaxBrokenLinkChecks: Math.min(
    100,
    Math.max(5, Number.parseInt(process.env.SEO_MAX_BROKEN_LINK_CHECKS ?? "40", 10) || 40),
  ),
  /** Deception Shield — DynamoDB events table (empty disables admin list repo). */
  deceptionEventsTable: process.env.DECEPTION_EVENTS_TABLE?.trim() ?? "",
  /** Agency CAD integrations (empty disables CAD admin HTTP handlers). */
  cadIntegrationsTable: process.env.CAD_INTEGRATIONS_TABLE?.trim() ?? "",
  activeCallsTable: process.env.ACTIVE_CALLS_TABLE?.trim() ?? "",
  callTransfersTable: process.env.CALL_TRANSFERS_TABLE?.trim() ?? "",
  websocketConnectionsTable: process.env.WEBSOCKET_CONNECTIONS_TABLE?.trim() ?? "",
  /** HTTPS management endpoint for API Gateway WebSocket (no wss:// prefix). */
  websocketApiEndpoint: process.env.WEBSOCKET_API_ENDPOINT?.trim() ?? "",
  /** Immutable CAD webhook receipts (TTL). */
  cadIncidentsRawTable: process.env.CAD_INCIDENTS_RAW_TABLE?.trim() ?? "",
  /** @deprecated Prefer {@link cadIncidentsRawTable}; legacy normalized CAD rows. */
  cadIncidentsTable: process.env.CAD_INCIDENTS_TABLE?.trim() ?? "",
  cadWebhookRateLimitsTable: process.env.CAD_WEBHOOK_RATE_LIMITS_TABLE?.trim() ?? "",
  cadWebhookIngestQueueUrl: process.env.CAD_WEBHOOK_INGEST_QUEUE_URL?.trim() ?? "",
  /** SNS topic for inbound CAD webhook payloads (HTTP publishes here; SQS subscribes — separate from dispatcher notify topic). */
  cadWebhookIngressTopicArn: process.env.CAD_WEBHOOK_INGRESS_TOPIC_ARN?.trim() ?? "",
  cadWebhookSnsTopicArn: process.env.CAD_WEBHOOK_SNS_TOPIC_ARN?.trim() ?? "",
  /** Short-TTL idempotency cache for `Idempotency-Key` replays (optional). */
  cadWebhookIdempotencyTable: process.env.CAD_WEBHOOK_IDEMPOTENCY_TABLE?.trim() ?? "",
  cadWebhookSecretSalt: process.env.CAD_WEBHOOK_SECRET_SALT?.trim() ?? "",
  /** Public API base URL (no trailing slash) for CAD webhook instructions. */
  cadPublicApiBaseUrl: process.env.CAD_PUBLIC_API_BASE_URL?.trim() ?? "",
  /** When true, CAD write-back HTTP routes accept submissions (otherwise 400). */
  cadWritebackEnabled: featureEnabled("CAD_WRITEBACK_ENABLED", false),
  /**
   * When true (default), write-backs require supervisor/admin approval before vendor HTTP.
   * Set CAD_WRITEBACK_REQUIRES_APPROVAL=false for direct submit.
   */
  cadWritebackRequiresApproval: process.env.CAD_WRITEBACK_REQUIRES_APPROVAL !== "false",
  /** Dynamo table for CAD write-back audit / approval queue. */
  cadWritebackAuditTable: process.env.CAD_WRITEBACK_AUDIT_TABLE?.trim() ?? "",
  /** When true, CAD API poller skips outbound vendor HTTP (dev/CI). */
  cadPollerMock: process.env.CAD_POLLER_MOCK === "1",
  /** Adobe Sign async provisioning ledger (`agreementId` PK). */
  pendingProvisionsTable: process.env.PENDING_PROVISIONS_TABLE?.trim() ?? "",
  /** Secrets Manager JSON: clientId, clientSecret, webhookToken. */
  adobeSignCredentialsSecretArn: process.env.ADOBE_SIGN_CREDENTIALS_SECRET_ARN?.trim() ?? "",
  adobeSignWebhookTokenInline: process.env.ADOBE_SIGN_WEBHOOK_TOKEN?.trim() ?? "",
  adobeSignApiBase:
    process.env.ADOBE_SIGN_API_BASE?.trim() || "https://api.na4.adobesign.com/api/rest/v6",
  adobeSignWebhookEnabled: process.env.ADOBE_SIGN_WEBHOOK_ENABLED !== "false",
  adobeSignMock: process.env.ADOBE_SIGN_MOCK === "true",
  rcAdminProvisioningFunctionName: process.env.PROVISIONING_FUNCTION_NAME?.trim() ?? "",
  rcAdminNotificationEmail:
    process.env.RC_ADMIN_NOTIFICATION_EMAIL?.trim() || "rcadmin@appsondemand.net",
  /** QR location registry (`QRLocationsTable`). Empty disables location handlers at runtime. */
  qrLocationsTable: process.env.QR_LOCATIONS_TABLE?.trim() ?? "",
};
