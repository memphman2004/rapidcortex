import { env } from "./env.js";
import { resolveAgencySender } from "./agencySmsSender.js";
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
 * Agency-aware variant: residents see their own agency's local number, and no agency can send
 * under another's sender. Degrades to the shared Messaging Service when the agency has no
 * registered number, so a missing record never blocks an emergency-path message.
 */
export async function buildSmsFactoryEnvForAgency(
  agencyId: string,
  opts?: { extraMock?: boolean },
): Promise<SmsFactoryEnv> {
  const agencySenderE164 = await resolveAgencySender(agencyId);
  return {
    ...buildSmsFactoryEnv(opts),
    agencySenderE164: agencySenderE164 ?? undefined,
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
