import type { SmsMessageType, SmsPrimaryProvider, SmsProviderMode, SmsSendResult } from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";
import { sendWithAwsSns } from "./awsSmsProvider.js";
import { sendMockSms } from "./mockSmsProvider.js";
import { sendWithTwilio } from "./twilioSmsProvider.js";

export type SmsFactoryEnv = {
  smsProvider: SmsProviderMode;
  /** When `SMS_PROVIDER=auto`, try this concrete provider first; secondary is the other. */
  smsPrimaryProvider: SmsPrimaryProvider;
  deploymentStage: string;
  /** Legacy + new: either forces mock path when true. */
  incidentMediaSmsMock: boolean;
  mockSmsProvider: boolean;
  awsRegion: string;
  awsSmsRegion?: string;
  awsSmsUseSimulator: boolean;
  twilioSecretArn: string;
  /** Non-secret operator config (passed through for AWS path logging / future Pinpoint). */
  awsSmsConfigurationSetName?: string;
  awsSmsPoolId?: string;
};

function shouldMock(env: SmsFactoryEnv): boolean {
  if (env.incidentMediaSmsMock || env.mockSmsProvider) return true;
  if (env.smsProvider === "mock") return true;
  return false;
}

function twilioConfigured(env: SmsFactoryEnv): boolean {
  return env.twilioSecretArn.trim().length > 0;
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
  };
}

function notConfiguredTwilio(): SmsSendResult {
  const sentAt = new Date().toISOString();
  return {
    provider: "twilio",
    status: "failed",
    errorCode: "TWILIO_NOT_CONFIGURED",
    errorMessage: "SMS_PROVIDER=twilio but Twilio secret ARN is empty",
    recipientRedacted: "***",
    sentAt,
    retryable: false,
  };
}

/**
 * One line per attempt (auto failover may log two). No raw phone or message body.
 */
function logRoutingAttempt(args: {
  attemptIndex: 1 | 2;
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
    smsPrimaryProvider?: SmsPrimaryProvider;
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
      smsPrimaryProvider: extra.smsPrimaryProvider ?? null,
      messageType: extra.messageType,
      agencyId: extra.agencyId,
      incidentId: extra.incidentId,
      destinationMasked: r.recipientRedacted,
      finalStatus: r.status,
      finalProvider: r.provider,
      providerSucceeded: r.status === "sent" ? r.provider : null,
      smsFailoverUsed: r.smsFailoverUsed === true,
      firstAttemptProvider: r.firstAttemptProvider ?? null,
      firstAttemptErrorCode: r.firstAttemptErrorCode ?? null,
    }),
  );
}

/**
 * Config-driven SMS for secure incident links: Twilio, AWS (SNS), auto with failover, or mock.
 * In `auto` mode, default primary is **Twilio**; on retryable primary failure, **AWS** is attempted.
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

  if (env.smsProvider === "twilio") {
    if (!twilioConfigured(env)) {
      return notConfiguredTwilio();
    }
    const destinationMasked = redactE164Phone(args.toPhoneE164);
    logRoutingAttempt({
      attemptIndex: 1,
      providerAttempted: "twilio",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      destinationMasked,
    });
    const r = await sendWithTwilio({
      secretArn: env.twilioSecretArn,
      toPhoneE164: args.toPhoneE164,
      messageBody: args.messageBody,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      messageType: args.messageType,
    });
    logRoutingSummary(r, {
      routingMode: "twilio",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
    });
    return r;
  }

  if (env.smsProvider === "aws") {
    const destinationMasked = redactE164Phone(args.toPhoneE164);
    logRoutingAttempt({
      attemptIndex: 1,
      providerAttempted: "aws",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      destinationMasked,
    });
    const r = await sendWithAwsSns(buildAwsCallArgs(env, args));
    logRoutingSummary(r, { routingMode: "aws", messageType: args.messageType, agencyId: args.agencyId, incidentId: args.incidentId });
    return r;
  }

  if (env.smsProvider === "auto") {
    return sendAutoFailover(env, args);
  }

  return sendMockSms({
    toPhoneE164: args.toPhoneE164,
    agencyId: args.agencyId,
    incidentId: args.incidentId,
    messageType: args.messageType,
  });
}

async function sendAutoFailover(
  env: SmsFactoryEnv,
  args: {
    toPhoneE164: string;
    messageBody: string;
    agencyId: string;
    incidentId: string;
    messageType: SmsMessageType;
  },
): Promise<SmsSendResult> {
  const primary: SmsPrimaryProvider = env.smsPrimaryProvider;

  const destinationMasked = redactE164Phone(args.toPhoneE164);

  /** When primary is Twilio but Twilio is not configured, use AWS directly (secondary path). */
  if (primary === "twilio" && !twilioConfigured(env)) {
    logRoutingAttempt({
      attemptIndex: 1,
      providerAttempted: "aws",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      destinationMasked,
    });
    const r = await sendWithAwsSns(buildAwsCallArgs(env, args));
    logRoutingSummary(
      { ...r, smsFailoverUsed: false },
      {
        routingMode: "auto",
        smsPrimaryProvider: primary,
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
      },
    );
    return { ...r, smsFailoverUsed: false };
  }

  if (primary === "twilio") {
    logRoutingAttempt({
      attemptIndex: 1,
      providerAttempted: "twilio",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      destinationMasked,
    });
    const first = await sendWithTwilio({
      secretArn: env.twilioSecretArn,
      toPhoneE164: args.toPhoneE164,
      messageBody: args.messageBody,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      messageType: args.messageType,
    });
    if (first.status === "sent") {
      logRoutingSummary(
        { ...first, smsFailoverUsed: false },
        {
          routingMode: "auto",
          smsPrimaryProvider: primary,
          messageType: args.messageType,
          agencyId: args.agencyId,
          incidentId: args.incidentId,
        },
      );
      return { ...first, smsFailoverUsed: false };
    }
    if (first.retryable === true) {
      logRoutingAttempt({
        attemptIndex: 2,
        providerAttempted: "aws",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked,
      });
      const second = await sendWithAwsSns(buildAwsCallArgs(env, args));
      if (second.status === "sent") {
        const r: SmsSendResult = {
          ...second,
          smsFailoverUsed: true,
          firstAttemptProvider: first.provider,
          firstAttemptErrorCode: first.errorCode,
        };
        logRoutingSummary(r, {
          routingMode: "auto",
          smsPrimaryProvider: primary,
          messageType: args.messageType,
          agencyId: args.agencyId,
          incidentId: args.incidentId,
        });
        return r;
      }
      const r: SmsSendResult = {
        ...second,
        smsFailoverUsed: true,
        firstAttemptProvider: first.provider,
        firstAttemptErrorCode: first.errorCode,
      };
      logRoutingSummary(r, {
        routingMode: "auto",
        smsPrimaryProvider: primary,
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
      });
      return r;
    }
    logRoutingSummary(
      { ...first, smsFailoverUsed: false },
      {
        routingMode: "auto",
        smsPrimaryProvider: primary,
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
      },
    );
    return { ...first, smsFailoverUsed: false };
  }

  /* primary === "aws" */
  logRoutingAttempt({
    attemptIndex: 1,
    providerAttempted: "aws",
    messageType: args.messageType,
    agencyId: args.agencyId,
    incidentId: args.incidentId,
    destinationMasked,
  });
  const first = await sendWithAwsSns(buildAwsCallArgs(env, args));
  if (first.status === "sent") {
    logRoutingSummary(
      { ...first, smsFailoverUsed: false },
      {
        routingMode: "auto",
        smsPrimaryProvider: primary,
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
      },
    );
    return { ...first, smsFailoverUsed: false };
  }
  if (first.retryable === true && twilioConfigured(env)) {
    logRoutingAttempt({
      attemptIndex: 2,
      providerAttempted: "twilio",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      destinationMasked,
    });
    const second = await sendWithTwilio({
      secretArn: env.twilioSecretArn,
      toPhoneE164: args.toPhoneE164,
      messageBody: args.messageBody,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      messageType: args.messageType,
    });
    if (second.status === "sent") {
      const r: SmsSendResult = {
        ...second,
        smsFailoverUsed: true,
        firstAttemptProvider: first.provider,
        firstAttemptErrorCode: first.errorCode,
      };
      logRoutingSummary(r, {
        routingMode: "auto",
        smsPrimaryProvider: primary,
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
      });
      return r;
    }
    const r: SmsSendResult = {
      ...second,
      smsFailoverUsed: true,
      firstAttemptProvider: first.provider,
      firstAttemptErrorCode: first.errorCode,
    };
    logRoutingSummary(r, {
      routingMode: "auto",
      smsPrimaryProvider: primary,
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
    });
    return r;
  }
  logRoutingSummary(
    { ...first, smsFailoverUsed: false },
    {
      routingMode: "auto",
      smsPrimaryProvider: primary,
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
    },
  );
  return { ...first, smsFailoverUsed: false };
}
