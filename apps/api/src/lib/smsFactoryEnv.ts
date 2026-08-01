import { env } from "./env.js";
import type { SmsFactoryEnv } from "../services/sms/smsProviderFactory.js";

/**
 * Single source of SMS routing config for every caller of `sendIncidentMediaLinkSms`.
 * Callers that own a feature-specific mock flag pass it via `extraMock`.
 */
export function buildSmsFactoryEnv(opts?: { extraMock?: boolean }): SmsFactoryEnv {
  return {
    smsProvider: env.smsProvider,
    smsPrimaryProvider: env.smsPrimaryProvider,
    deploymentStage: env.deploymentStage,
    incidentMediaSmsMock: env.incidentMediaSmsMock || opts?.extraMock === true,
    mockSmsProvider: env.mockSmsProvider,
    awsRegion: env.region,
    awsSmsRegion: env.awsSmsRegion,
    awsSmsUseSimulator: env.awsSmsUseSimulator,
    twilioSecretArn: env.incidentMediaTwilioSecretArn,
    awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
    awsSmsPoolId: env.awsSmsPoolId,
    smsStatusCallbackUrl: statusCallbackUrl(),
  };
}

/**
 * Derived from the public API base rather than carried as its own env var: the Ring and Nest
 * Lambdas are within ~40 bytes of Lambda's 4KB environment ceiling.
 */
export function statusCallbackUrl(): string {
  if (env.smsStatusCallbackUrl) return env.smsStatusCallbackUrl;
  const base = env.ringPublicApiBaseUrl.replace(/\/$/, "");
  if (!base) return "";
  return `${base}/api/sms/twilio/status`;
}
