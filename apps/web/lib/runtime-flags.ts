import { isPilotTestModeEnabled } from "./pilot-test-mode";

const NEXT_PUBLIC_FLAG_VALUES: Record<string, string | undefined> = {
  NEXT_PUBLIC_OFFLINE_DEMO_MODE: process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE,
  NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM: process.env.NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM,
  NEXT_PUBLIC_ENABLE_QA_SCORING: process.env.NEXT_PUBLIC_ENABLE_QA_SCORING,
  NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA: process.env.NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA,
  NEXT_PUBLIC_ENABLE_CALLER_MEDIA: process.env.NEXT_PUBLIC_ENABLE_CALLER_MEDIA,
  NEXT_PUBLIC_ENABLE_LIVE_VIDEO: process.env.NEXT_PUBLIC_ENABLE_LIVE_VIDEO,
  NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI: process.env.NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI,
  NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE: process.env.NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE,
  NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS: process.env.NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS,
  NEXT_PUBLIC_ENABLE_CALLER_CARD: process.env.NEXT_PUBLIC_ENABLE_CALLER_CARD,
  NEXT_PUBLIC_ENABLE_SUPERVISOR_PERFORMANCE: process.env.NEXT_PUBLIC_ENABLE_SUPERVISOR_PERFORMANCE,
  NEXT_PUBLIC_ENABLE_ADMIN_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ADMIN_ANALYTICS,
  NEXT_PUBLIC_ENABLE_CROSS_JURISDICTION_SHARES: process.env.NEXT_PUBLIC_ENABLE_CROSS_JURISDICTION_SHARES,
  NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE: process.env.NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE,
  NEXT_PUBLIC_ENABLE_DECEPTION_SHIELD_UI: process.env.NEXT_PUBLIC_ENABLE_DECEPTION_SHIELD_UI,
  NEXT_PUBLIC_ENABLE_CAD_ADMIN: process.env.NEXT_PUBLIC_ENABLE_CAD_ADMIN,
  NEXT_PUBLIC_ENABLE_CAD_WRITEBACK: process.env.NEXT_PUBLIC_ENABLE_CAD_WRITEBACK,
  NEXT_PUBLIC_ENABLE_SLA_BACKLOG: process.env.NEXT_PUBLIC_ENABLE_SLA_BACKLOG,
  NEXT_PUBLIC_ENABLE_WAR_ROOMS: process.env.NEXT_PUBLIC_ENABLE_WAR_ROOMS,
  NEXT_PUBLIC_ENABLE_STAKEHOLDER_PAGES: process.env.NEXT_PUBLIC_ENABLE_STAKEHOLDER_PAGES,
  NEXT_PUBLIC_ENABLE_POST_INCIDENT_REVIEWS: process.env.NEXT_PUBLIC_ENABLE_POST_INCIDENT_REVIEWS,
  NEXT_PUBLIC_ENABLE_PINPOINT: process.env.NEXT_PUBLIC_ENABLE_PINPOINT,
  NEXT_PUBLIC_ENABLE_SILENT_TEXT: process.env.NEXT_PUBLIC_ENABLE_SILENT_TEXT,
  NEXT_PUBLIC_ENABLE_SURGE: process.env.NEXT_PUBLIC_ENABLE_SURGE,
  NEXT_PUBLIC_ENABLE_REPORTS: process.env.NEXT_PUBLIC_ENABLE_REPORTS,
  NEXT_PUBLIC_ENABLE_EMERGENCY_CONNECT: process.env.NEXT_PUBLIC_ENABLE_EMERGENCY_CONNECT,
  NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING: process.env.NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING,
  NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL: process.env.NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL,
  NEXT_PUBLIC_ENABLE_CALL_CONTROL: process.env.NEXT_PUBLIC_ENABLE_CALL_CONTROL,
  NEXT_PUBLIC_ENABLE_CALL_CONTROL_WS: process.env.NEXT_PUBLIC_ENABLE_CALL_CONTROL_WS,
  NEXT_PUBLIC_ENABLE_NETWORK_ACCESS_GATE: process.env.NEXT_PUBLIC_ENABLE_NETWORK_ACCESS_GATE,
  NEXT_PUBLIC_ENABLE_NETWORK_ACCESS: process.env.NEXT_PUBLIC_ENABLE_NETWORK_ACCESS,
  NEXT_PUBLIC_ENABLE_VENUE_INTELLIGENCE: process.env.NEXT_PUBLIC_ENABLE_VENUE_INTELLIGENCE,
  NEXT_PUBLIC_ENABLE_LOCATIONS_QR_ADMIN: process.env.NEXT_PUBLIC_ENABLE_LOCATIONS_QR_ADMIN,
  NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
};

const CAD_WRITEBACK_FLAG = "NEXT_PUBLIC_ENABLE_CAD_WRITEBACK";

function isEnabledValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function isDisabledValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "0" || normalized === "false";
}

/**
 * Operational feature gates default **on** when unset (live product surface).
 * CAD write-back defaults **off** unless explicitly enabled.
 */
function envFlag(name: string): boolean {
  if (typeof process === "undefined") return false;
  const value = NEXT_PUBLIC_FLAG_VALUES[name] ?? process.env[name];
  if (name === CAD_WRITEBACK_FLAG) {
    if (isEnabledValue(value)) return true;
    return false;
  }
  if (isDisabledValue(value)) return false;
  if (isEnabledValue(value)) return true;
  if (isPilotTestModeEnabled()) return true;
  return true;
}

/**
 * Explicit opt-in for local/sales builds that use in-browser mock incidents without a configured API.
 * Pilot and production hosts must leave this unset so the dashboard does not show fake queue data.
 */
export function isOfflineDemoDataEnabled(): boolean {
  return isEnabledValue(NEXT_PUBLIC_FLAG_VALUES.NEXT_PUBLIC_OFFLINE_DEMO_MODE);
}

/**
 * Scripted transcript stream controls on the **dispatcher dashboard** (not `/demo`).
 * Off by default when the API is live so pilots are not nudged toward simulated traffic.
 * Enable for academy drills that POST chunks to the real API, or use offline demo mode locally.
 */
export function isTrainingTranscriptToolbarEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (isOfflineDemoDataEnabled()) return true;
  if (isPilotTestModeEnabled()) return true;
  return isEnabledValue(NEXT_PUBLIC_FLAG_VALUES.NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM);
}

/** F1 automated QA scoring (sessions, templates, Bedrock structured score). Off by default. */
export function isQaScoringEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_QA_SCORING");
}

/** F2 caller media SMS + S3 upload link. Off by default. */
export function isIncidentMediaEnabled(): boolean {
  return (
    envFlag("NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA") || envFlag("NEXT_PUBLIC_ENABLE_CALLER_MEDIA")
  );
}

/** Live video V2 caller stream + dispatcher viewer. */
export function isLiveVideoEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_LIVE_VIDEO");
}

/** F4 SOP-aware protocol surfacing (must match API ENABLE_SOP_PROTOCOL_AI). */
export function isSopProtocolEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI");
}

/** F3 non-emergency triage (must match API ENABLE_NON_EMERGENCY_TRIAGE). */
export function isNonEmergencyTriageEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE");
}

/** F5 supervisor wellness flags API (dispatchers must never enable this client flag). */
export function isDispatcherWellnessUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS");
}

/** F7 caller card API + panel (must match API ENABLE_CALLER_CARD). */
export function isCallerCardEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_CALLER_CARD");
}

/** F9 supervisor performance + coaching (API routes always on when deployed). */
export function isSupervisorPerformanceUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_SUPERVISOR_PERFORMANCE");
}

/** F8 admin analytics summary + CSV (must match admin API usage). */
export function isAdminAnalyticsUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_ADMIN_ANALYTICS");
}

/** F6 cross-jurisdiction sharing UI (must match API ENABLE_CROSS_JURISDICTION_SHARES). */
export function isCrossJurisdictionSharesUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_CROSS_JURISDICTION_SHARES");
}

/** Internal Cortex SEO Intelligence dashboard (admin-only routes + API). Off by default. */
export function isSeoIntelligenceUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE");
}

/** Deception Shield dashboard (requires API + Dynamo; rcsuperadmin/agencyit/rcitadmin server/middleware gated). Opt-in UI. */
export function isDeceptionShieldUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_DECEPTION_SHIELD_UI");
}

/** CAD integration admin (SAM stack-1 `/api/admin/cad-*`). Opt-in UI. */
export function isCadAdminUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_CAD_ADMIN");
}

/** CAD vendor write-back from dispatcher workspace (requires API Step 7). Off by default. */
export function isCadWritebackUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_CAD_WRITEBACK");
}

/** Call queue backlog + SLA monitoring (dispatcher/supervisor dashboards). */
export function isSlaBacklogEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_SLA_BACKLOG");
}

/** Major incident war rooms (supervisor/command collaboration). */
export function isWarRoomsEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_WAR_ROOMS");
}

/** Stakeholder / elected-official status pages for major incidents. */
export function isStakeholderPagesEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_STAKEHOLDER_PAGES");
}

/** Post-incident review documents (compliance / after-action). */
export function isPostIncidentReviewsEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_POST_INCIDENT_REVIEWS");
}

/** LiveLocation (SMS GPS link) — API ENABLE_PINPOINT. */
export function isPinpointEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_PINPOINT");
}

/**
 * Silent Text (SMS → web text chat for unsafe-to-speak callers). Must align with API
 * `ENABLE_SILENT_TEXT` + a configured SMS provider (Twilio secret ARN or AWS SNS) — otherwise
 * starting a session will return ok=false and audit `SILENT_TEXT_SMS_FAILED`. Off by default.
 */
export function isSilentTextEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_SILENT_TEXT");
}

/** Surge View — related-call clustering (API ENABLE_SURGE). */
export function isSurgeEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_SURGE");
}

/** Agency reporting (call volume, SLA, QA, dispatcher performance). */
export function isReportsEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_REPORTS");
}

/** Emergency Connect — hospital pre-arrival alerts (must match API ENABLE_EMERGENCY_CONNECT). */
export function isEmergencyConnectEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_EMERGENCY_CONNECT");
}

/** Hospital routing — live capacity, diversion, and transport recommendations. */
export function isHospitalRoutingEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING");
}

/** Hospital staff portal — manual capacity updates without HL7. */
export function isHospitalPortalEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const portal = NEXT_PUBLIC_FLAG_VALUES.NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL;
  const routing = NEXT_PUBLIC_FLAG_VALUES.NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING;
  if (isDisabledValue(portal) && isDisabledValue(routing)) return false;
  if (isEnabledValue(portal) || isEnabledValue(routing)) return true;
  if (isPilotTestModeEnabled()) return true;
  return true;
}

/** Supervisor/dispatcher call transfer coordination (notification-only MVP). */
export function isCallControlEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_CALL_CONTROL");
}

/** Real-time call control via API Gateway WebSocket (requires NEXT_PUBLIC_WEBSOCKET_URL). */
export function isCallControlWebSocketEnabled(): boolean {
  if (typeof process === "undefined") return false;
  if (!isCallControlEnabled()) return false;
  if (!isEnabledValue(NEXT_PUBLIC_FLAG_VALUES.NEXT_PUBLIC_ENABLE_CALL_CONTROL_WS) && !isPilotTestModeEnabled()) {
    return false;
  }
  const url = NEXT_PUBLIC_FLAG_VALUES.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
  return Boolean(url);
}

/**
 * Edge middleware calls the API preflight before protected HTML routes. Requires API
 * `NETWORK_ACCESS_ENFORCEMENT` when agencies use IP/time policies. Off by default.
 */
export function isNetworkAccessGateEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_NETWORK_ACCESS_GATE");
}

/** Network access policy admin UI (IP allowlist + shift hours). */
export function isNetworkAccessSettingsUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_NETWORK_ACCESS");
}

/** Venue intelligence + facility camera routing UI surfaces. */
export function isVenueIntelligenceUiEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_VENUE_INTELLIGENCE");
}

/** QR location registry admin (campus + venue scan points). */
export function isLocationsQrAdminEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ENABLE_LOCATIONS_QR_ADMIN");
}
