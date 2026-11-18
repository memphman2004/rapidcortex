/**
 * Demo Mode contracts. Payloads follow the same event names the product already
 * uses so existing panels can render fictional Maplewood County data.
 */

export const DEMO_AGENCY_ID = "demo-maplewood-county";

export const DEMO_MODE_BANNER_TEXT =
  "DEMO MODE — Fictional Data Only — Not Connected to Live 911 Operations";

export type DemoEventType =
  | "CALL_RECEIVED"
  | "CALL_ANSWERED"
  | "UNIT_DISPATCHED"
  | "UNIT_STATUS_CHANGED"
  | "INCIDENT_CREATED"
  | "INCIDENT_UPDATED"
  | "INCIDENT_CLOSED"
  | "CALL_ASSIST_SUGGESTION"
  | "TRANSCRIPTION_UPDATE"
  | "TRANSLATION_DETECTED"
  | "SUPERVISOR_ALERT"
  | "QUEUE_DEPTH_CHANGED"
  | "REPEAT_CALLER_FLAGGED"
  | "MUTUAL_AID_REQUESTED"
  | "ADMIN_CALL_ROUTED"
  | "CONTINUITY_LOG_UPDATED";

export type DemoEventPayload = { [key: string]: unknown };

export type DemoHighlightPlacement = "top" | "bottom" | "left" | "right";

export interface GuidedHighlight {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  placement: DemoHighlightPlacement;
  triggerMode: "auto" | "manual";
}

export interface DemoEvent {
  id: string;
  relativeOffsetSeconds: number;
  type: DemoEventType;
  payload: DemoEventPayload;
  /** Presenter-facing line for the control-panel event log. */
  summary: string;
  highlightId?: string;
}

export type DemoUnitStatus =
  | "available"
  | "dispatched"
  | "en_route"
  | "on_scene"
  | "transporting"
  | "cleared";

export interface DemoAgency {
  id: string;
  name: string;
  location: string;
  jurisdiction: string;
  populationServed: number;
  facilityType: string;
  disciplines: string[];
  annualEmergencyCalls: number;
  annualAdminCalls: number;
  cadDescription: string;
}

export interface DemoDispatcher {
  id: string;
  name: string;
  role: "Lead Dispatcher" | "Dispatcher" | "Supervisor";
  position: number | null;
  onShift: boolean;
  remote: boolean;
}

export interface DemoUnit {
  id: string;
  type: string;
  agency: string;
  assignment: string;
  discipline: "law" | "fire" | "ems";
  status: DemoUnitStatus;
  incidentId?: string;
}

export interface DemoLocation {
  id: string;
  label: string;
  kind: "address" | "intersection" | "landmark";
}

export interface DemoCall {
  id: string;
  discipline: "law" | "fire" | "ems" | "admin";
  priority: "emergency" | "non-emergency";
  summary: string;
  locationId: string;
  language: string;
  status: "queued" | "active" | "handled" | "closed";
  positionId?: string;
  repeatCaller: boolean;
  phone: string;
  callAssist?: string;
}

export interface DemoTranscriptLine {
  speaker: "caller" | "dispatcher" | "system";
  text: string;
  offsetSeconds: number;
}

export interface DemoIncident {
  id: string;
  callId: string;
  title: string;
  discipline: "law" | "fire" | "ems";
  locationId: string;
  status: "active" | "controlled" | "closed";
  major: boolean;
  mci: boolean;
  units: string[];
  continuity: string[];
  transcript: DemoTranscriptLine[];
  callAssist?: string;
  translation?: { language: string; note: string };
  commandNotes: string[];
  patientCount?: number;
  openedAtSeconds: number;
}

export interface DemoAlert {
  id: string;
  message: string;
  offsetSeconds: number;
}

export interface DemoAgencyState {
  agency: DemoAgency;
  dispatchers: DemoDispatcher[];
  units: DemoUnit[];
  locations: DemoLocation[];
  activeIncidents: DemoIncident[];
  closedIncidents: DemoIncident[];
  callQueue: DemoCall[];
  alerts: DemoAlert[];
  mutualAid: string[];
  coverageGap: boolean;
  recentActivity: string[];
  metrics: {
    callsAnswered: number;
    queueDepth: number;
    adminRouted: number;
    callsLast30Minutes: number;
  };
  shiftSummary?: string;
  clockLabel: string;
}

export interface DemoScenarioManifest {
  id: string;
  displayName: string;
  description: string;
  audience: string;
  featureHighlights: string[];
  estimatedDurationSeconds: number;
  manualAdvance: boolean;
  enabled: boolean;
  startingState: DemoAgencyState;
  events: DemoEvent[];
  guidedHighlights?: GuidedHighlight[];
}

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "completed";

export type PlaybackEngineEvent =
  | "started"
  | "paused"
  | "resumed"
  | "reset"
  | "completed"
  | "event_fired"
  | "highlight"
  | "changed";

export interface DemoLogEntry {
  offsetSeconds: number;
  type: DemoEventType;
  summary: string;
  eventId: string;
}

export interface DemoSessionMeta {
  source: "env" | "role" | "link" | "presenter";
  scenarioId?: string;
  offsetSeconds?: number;
  tourStop?: string;
  issuer?: string;
  jti?: string;
}

export interface DemoTokenClaims {
  v: 1;
  scenarioId: string;
  offsetSeconds: number;
  tourStop: string;
  exp: number;
  iss: string;
  jti: string;
}

export type DemoTokenFailure = "invalid" | "expired" | "revoked" | "unconfigured";

export interface DemoSnapshot {
  status: PlaybackStatus;
  scenarioId: string | null;
  displayName: string | null;
  offsetSeconds: number;
  durationSeconds: number;
  speed: number;
  manualAdvance: boolean;
  log: DemoLogEntry[];
  state: DemoAgencyState | null;
  activeHighlight: GuidedHighlight | null;
  highlightIndex: number;
}
