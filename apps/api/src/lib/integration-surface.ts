import { resolveTranscriptConnectorRollout } from "rapid-cortex-integrations";
import { getAiRuntimeConfig } from "../ai/aiConfig.js";
import { env } from "./env.js";
import {
  getMultilingualVoiceConfig,
  isMultilingualStrictValidationEnabled,
  validateMultilingualDeploymentConfig,
} from "../voice/multilingualConfig.js";

/**
 * Feature-flagged connector surface + pilot-readiness signals for `/api/integration/status`.
 * Safe to expose to authenticated agency users (no secret values).
 */
export function buildIntegrationStatusPayload(agencyId: string) {
  const transcriptSource = resolveTranscriptConnectorRollout(
    process.env.INTEGRATION_TRANSCRIPT_CONNECTOR_MODE,
    agencyId,
    process.env.INTEGRATION_TRANSCRIPT_AGENCY_ALLOWLIST,
  );

  const ai = getAiRuntimeConfig();
  const multilingualIssues = validateMultilingualDeploymentConfig();
  const voiceCfg = getMultilingualVoiceConfig();

  const twilioArn = env.incidentMediaTwilioSecretArn.trim();
  const smsMode = env.smsProvider;
  const mockSmsPath =
    env.incidentMediaSmsMock || env.mockSmsProvider || smsMode === "mock" || env.awsSmsUseSimulator;

  return {
    agencyId,
    transcriptSource,
    auditHint:
      "Emit integration health and connector toggles using AUDIT_EVENT_TYPES.INTEGRATION_STATE (or equivalent) when changing rollout.",
    deploymentStage: process.env.DEPLOYMENT_STAGE?.trim() || "unknown",
    sms: {
      providerMode: smsMode,
      twilioConfigured: Boolean(twilioArn),
      awsSendAttempted: smsMode === "aws" || smsMode === "auto",
      failoverToTwilioEnabled: smsMode === "auto" && Boolean(twilioArn),
      mockOrSimulatorPath: mockSmsPath,
      nonProdSandboxHint:
        env.deploymentStage !== "prod" && mockSmsPath
          ? "Lower environment: SMS may use mock, simulator, or sandbox-capable paths. Verify production origination and spend limits before go-live."
          : null,
    },
    pilotReadiness: {
      languageSessionsConfigured: Boolean(env.languageSessionsTable),
      multilingualStrictValidation: isMultilingualStrictValidationEnabled(),
      multilingualIssueCount: multilingualIssues.length,
      multilingualPrimaryStt: voiceCfg.primarySttProvider,
      multilingualPrimaryTranslation: voiceCfg.primaryTranslationProvider,
      multilingualPrimaryLanguageDetector: voiceCfg.primaryLanguageDetector,
      aiPrimaryProvider: ai.primaryProvider,
      aiSecondaryProvider: ai.secondaryProvider,
      aiTertiaryProvider: ai.tertiaryProvider,
      assetsBucketConfigured: Boolean(env.assetsBucket),
    },
  };
}
