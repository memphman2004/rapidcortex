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
    deploymentStage: env.deploymentStage,
    incidentMediaSmsMock: env.incidentMediaSmsMock || opts?.extraMock === true,
    mockSmsProvider: env.mockSmsProvider,
    awsRegion: env.region,
    awsSmsRegion: env.awsSmsRegion,
    awsSmsUseSimulator: env.awsSmsUseSimulator,
    awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
    awsSmsPoolId: env.awsSmsPoolId,
  };
}

/**
 * Agency-aware variant: residents see their own agency's local number, and no agency can send
 * under another's sender. Degrades to the shared origination pool when the agency has no
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
