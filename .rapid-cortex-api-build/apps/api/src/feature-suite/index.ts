/**
 * Feature suite public surface — integration helpers + table/authz utilities.
 */

export { FEATURE_PERMISSIONS, type FeaturePermission } from "./authz.js";
export { FeatureError, writeFeatureAudit, type FeatureActor } from "./errors.js";
export {
  isFeaturesSuiteEnabled,
  FeatureTables,
  normalizePhone,
  normalizeAddress,
  encodeGeohash,
} from "./tables.js";
export { matchFeaturesHttpRoute } from "./http-dispatch.js";

/** Integration: deposit address incident intelligence after close. */
export { depositIncidentIntelligence } from "./citizen-intelligence.js";

/** Integration: evaluate alternative response from transcript analysis. */
export { evaluateAlternativeResponse } from "./response-routing.js";

/** Integration: create evidence chain-of-custody record (+ upload URL). */
export {
  createEvidenceRecord,
  getMCIEvent,
} from "./command-call-enhancement.js";

/** Integration: ingest social awareness signal. */
export { ingestSocialSignal } from "./training-predictive-safety.js";

/** Fire-and-forget hooks for existing Lambdas. */
export {
  maybeDepositAddressIntelOnCadClose,
  maybeEvaluateAltResponseAfterAnalysis,
  maybeCreateEvidenceOnMediaUpload,
} from "./integrations.js";

/** Scheduled helpers */
export {
  runLearningAnalysisForAgencies,
  escalateExpiredCheckInTimers,
} from "./training-predictive-safety.js";
