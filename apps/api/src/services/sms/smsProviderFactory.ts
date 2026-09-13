import type { SmsMessageType, SmsProviderMode, SmsSendResult } from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";
import { sendWithAwsSms } from "./awsSmsProvider.js";
import { sendMockSms } from "./mockSmsProvider.js";

export type SmsFactoryEnv = {
  smsProvider: SmsProviderMode;
  deploymentStage: string;
  /** Either flag forces the mock path. */
  incidentMediaSmsMock: boolean;
  mockSmsProvider: boolean;
  awsRegion: string;
  awsSmsRegion?: string;
  awsSmsUseSimulator: boolean;
  /** Non-secret operator config (passed through for AWS path logging / Pinpoint). */
  awsSmsConfigurationSetName?: string;
  awsSmsPoolId?: string;
  /**
   * Agency-owned sending number, already resolved and tenant-scoped by the caller.
   * Empty means fall back to the shared origination pool.
   */
  agencySenderE164?: string;
};

function shouldMock(env: SmsFactoryEnv): boolean {
  if (env.incidentMediaSmsMock || env.mockSmsProvider) return true;
  if (env.smsProvider === "mock") return true;
  return false;
}

function buildAwsCallArgs(
  env: SmsFactoryEnv,
  base: {
    toPhoneE164: string;
    messageBody: string;
    agencyId: string;
    incidentId: string;
    messageType: SmsMessageType;
  },
) {
  return {
    ...base,
    region: env.awsSmsRegion?.trim() || env.awsRegion,
    useSimulator: env.awsSmsUseSimulator,
    configurationSetName: env.awsSmsConfigurationSetName,
    poolId: env.awsSmsPoolId,
    agencySenderE164: env.agencySenderE164,
  };
}

/**
 * One line per attempt. No raw phone or message body.
 */
function logRoutingAttempt(args: {
  attemptIndex: 1;
  providerAttempted: SmsSendResult["provider"];
  messageType: SmsMessageType;
  agencyId: string;
  incidentId: string;
  destinationMasked: string;
}): void {
  console.info(
    JSON.stringify({
      type: "outbound.sms",
      event: "routing_attempt",
      ...args,
    }),
  );
}

/**
 * One summary line per send for CloudWatch: routing outcome (no PII, no body).
 */
function logRoutingSummary(
  r: SmsSendResult,
  extra: {
    routingMode: SmsProviderMode;
    messageType: SmsMessageType;
    agencyId: string;
    incidentId: string;
  },
): void {
  console.info(
    JSON.stringify({
      type: "outbound.sms",
      event: "routing_complete",
      routingMode: extra.routingMode,
      messageType: extra.messageType,
      agencyId: extra.agencyId,
      incidentId: extra.incidentId,
      destinationMasked: r.recipientRedacted,
      finalStatus: r.status,
      finalProvider: r.provider,
      providerSucceeded: r.status === "sent" ? r.provider : null,
    }),
  );
}

/**
 * Config-driven SMS for secure incident links: AWS End User Messaging or mock.
 */
export async function sendIncidentMediaLinkSms(
  env: SmsFactoryEnv,
  args: {
    toPhoneE164: string;
    messageBody: string;
    agencyId: string;
    incidentId: string;
    messageType: SmsMessageType;
  },
): Promise<SmsSendResult> {
  if (shouldMock(env)) {
    return sendMockSms({
      toPhoneE164: args.toPhoneE164,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      messageType: args.messageType,
    });
  }

  const destinationMasked = redactE164Phone(args.toPhoneE164);
  logRoutingAttempt({
    attemptIndex: 1,
    providerAttempted: "aws",
    messageType: args.messageType,
    agencyId: args.agencyId,
    incidentId: args.incidentId,
    destinationMasked,
  });
  const r = await sendWithAwsSms(buildAwsCallArgs(env, args));
  logRoutingSummary(r, {
    routingMode: "aws",
    messageType: args.messageType,
    agencyId: args.agencyId,
    incidentId: args.incidentId,
  });
  return r;
}
