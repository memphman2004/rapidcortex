/**
 * Default Lambda env for handler-level integration tests (no real AWS calls).
 * Loaded via vitest `setupFiles` so `../lib/env` resolves before handlers import repositories.
 */
process.env.AWS_REGION ??= "us-east-1";
process.env.INCIDENTS_TABLE ??= "test-incidents";
process.env.TRANSCRIPTS_TABLE ??= "test-transcripts";
process.env.ANALYSES_TABLE ??= "test-analyses";
process.env.AUDIT_TABLE ??= "test-audit";
/** Enables access override Lambda routes in Vitest (`AccessOverrideRepository` resolves table name). */
process.env.ACCESS_OVERRIDES_TABLE ??= "test-access-overrides";
/** Enables `resolveCognitoUser` in access-override flows when assertions need synthetic Cognito data. */
process.env.COGNITO_USER_POOL_ID ??= "test-user-pool";
process.env.API_CLIENTS_TABLE ??= "test-api-clients";
process.env.WEBHOOKS_TABLE ??= "test-webhooks";
process.env.EXTERNAL_API_RATE_LIMITS_TABLE ??= "test-external-api-rate";
process.env.EXTERNAL_API_JWT_SECRET ??= "test-jwt-signing-secret-must-be-32-characters-min";
process.env.EXTERNAL_API_ENCRYPTION_KEY ??= "test-webhook-passphrase-sixteen-characters-min";
process.env.AGENCIES_TABLE ??= "test-agencies";
process.env.INVITES_TABLE ??= "test-invites";
process.env.BILLING_PROFILES_TABLE ??= "test-billing-profiles";
process.env.BILLING_WEBHOOK_EVENTS_TABLE ??= "test-billing-webhooks";
process.env.ASSETS_BUCKET ??= "test-assets-bucket";
process.env.LANGUAGE_SESSIONS_TABLE ??= "test-language-sessions";
process.env.DEPLOYMENT_STAGE ??= "dev";
process.env.AUTO_ANALYZE_EVERY_N_SEGMENTS ??= "0";
process.env.PREMISE_NOTES_TABLE ??= "test-premise-notes";
process.env.ENABLE_CALLER_CARD ??= "true";
process.env.DISPATCHER_COACHING_NOTES_TABLE ??= "test-coaching-notes";
process.env.INCIDENT_SHARES_TABLE ??= "test-incident-shares";
process.env.AGENCY_SHARE_PARTNERS_TABLE ??= "test-share-partners";
process.env.ENABLE_LIVE_VIDEO ??= "true";
process.env.LIVE_VIDEO_SESSIONS_TABLE ??= "test-live-video-sessions";
process.env.LIVE_VIDEO_PUBLIC_BASE_URL ??= "https://rapidcortex.test";
/** Unit tests: avoid storage stream path unless a test overrides. */
process.env.LIVE_VIDEO_STORAGE_MODE = "off";
process.env.ENABLE_INCIDENT_MEDIA ??= "true";
process.env.INCIDENT_MEDIA_TABLE ??= "test-incident-media";
process.env.INCIDENT_MEDIA_PUBLIC_BASE_URL ??= "https://rapidcortex.test";
/** Security tests: `resolveIncidentRead` uses cross-jurisdiction shares when enabled. */
process.env.ENABLE_CROSS_JURISDICTION_SHARES ??= "true";
process.env.SEO_INTELLIGENCE_TABLE ??= "test-seo-intelligence";
process.env.SEO_TOOL_ENABLED ??= "true";
process.env.DECEPTION_EVENTS_TABLE ??= "test-deception-events";
process.env.DECEPTION_SHIELD_ENABLED ??= "false";
process.env.OPS_ALERTS_TOPIC_ARN ??= "";
process.env.CAD_INTEGRATIONS_TABLE ??= "test-cad-integrations";
process.env.CAD_WRITEBACK_AUDIT_TABLE ??= "test-cad-writeback-audit";
process.env.CAD_WRITEBACK_ENABLED ??= "false";
process.env.CAD_WRITEBACK_REQUIRES_APPROVAL ??= "true";
