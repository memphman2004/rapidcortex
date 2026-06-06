export const INTEGRATIONS_PACKAGE_VERSION = "0.2.0";

export type { AudioConnectionState, AudioInputAdapter } from "./audio-adapter.js";
export type { CadAdapter, CadCallerCardContext } from "./cad-adapter.js";
export type { IncidentEventFeedAdapter } from "./incident-event-adapter.js";
export type { IntegrationDomainEvent } from "./normalized-events.js";
export type {
  ConnectorHealth,
  ConnectorHealthSnapshot,
  IntegrationConnectorId,
  IntegrationHealthAdapter,
} from "./integration-health.js";
export {
  AwsTranscribeStreamPlaceholder,
  type TranscriptSourceAdapter,
  type TranscriptStreamSessionState,
} from "./transcript-source.js";

export {
  MockAudioInputAdapter,
  MockCadAdapter,
  MockIncidentEventFeedAdapter,
  MockIntegrationHealthAdapter,
} from "./mock-connectors.js";

export { WebhookEventIngressPlaceholder } from "./placeholders/webhook-ingress-placeholder.js";
export { CadSummaryPushPlaceholder } from "./placeholders/cad-summary-push-placeholder.js";
export { TelephonyInputPlaceholder } from "./placeholders/telephony-input-placeholder.js";
export {
  resolveTranscriptConnectorRollout,
  type TranscriptConnectorMode,
  type TranscriptConnectorResolution,
} from "./connector-rollout.js";
