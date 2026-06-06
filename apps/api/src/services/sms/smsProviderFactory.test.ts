import { describe, it, expect, vi, beforeEach } from "vitest";
import * as aws from "./awsSmsProvider.js";
import * as twilio from "./twilioSmsProvider.js";
import { sendIncidentMediaLinkSms, type SmsFactoryEnv } from "./smsProviderFactory.js";

vi.mock("./awsSmsProvider.js", () => ({
  sendWithAwsSns: vi.fn(),
}));

vi.mock("./twilioSmsProvider.js", () => ({
  sendWithTwilio: vi.fn(),
}));

const baseEnv: SmsFactoryEnv = {
  smsProvider: "auto",
  smsPrimaryProvider: "twilio",
  deploymentStage: "prod",
  incidentMediaSmsMock: false,
  mockSmsProvider: false,
  awsRegion: "us-east-1",
  awsSmsRegion: "",
  awsSmsUseSimulator: false,
  twilioSecretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:twilio-AbCdEf",
};

const baseArgs = {
  toPhoneE164: "+15555550100",
  messageBody: "Rapid Cortex: test",
  agencyId: "agency-1",
  incidentId: "inc-1",
  messageType: "media_upload" as const,
};

describe("sendIncidentMediaLinkSms", () => {
  beforeEach(() => {
    vi.mocked(aws.sendWithAwsSns).mockReset();
    vi.mocked(twilio.sendWithTwilio).mockReset();
  });

  it("uses mock when MOCK_SMS_PROVIDER is true", async () => {
    const r = await sendIncidentMediaLinkSms(
      { ...baseEnv, mockSmsProvider: true, smsProvider: "aws" },
      baseArgs,
    );
    expect(r.provider).toBe("mock");
    expect(aws.sendWithAwsSns).not.toHaveBeenCalled();
  });

  it("aws mode calls AWS only", async () => {
    vi.mocked(aws.sendWithAwsSns).mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "m1",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const r = await sendIncidentMediaLinkSms({ ...baseEnv, smsProvider: "aws" }, baseArgs);
    expect(r.status).toBe("sent");
    expect(aws.sendWithAwsSns).toHaveBeenCalledTimes(1);
    expect(vi.mocked(aws.sendWithAwsSns).mock.calls[0]![0].messageType).toBe("media_upload");
  });

  it("twilio mode calls Twilio only", async () => {
    vi.mocked(twilio.sendWithTwilio).mockResolvedValue({
      provider: "twilio",
      status: "sent",
      messageId: "SMx",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const r = await sendIncidentMediaLinkSms({ ...baseEnv, smsProvider: "twilio" }, baseArgs);
    expect(r.provider).toBe("twilio");
    expect(twilio.sendWithTwilio).toHaveBeenCalledTimes(1);
    expect(vi.mocked(twilio.sendWithTwilio).mock.calls[0]![0].messageType).toBe("media_upload");
  });

  it("auto with primary twilio fails over to AWS on retryable Twilio failure", async () => {
    vi.mocked(twilio.sendWithTwilio).mockResolvedValue({
      provider: "twilio",
      status: "failed",
      errorCode: "HTTP_500",
      errorMessage: "boom",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: true,
    });
    vi.mocked(aws.sendWithAwsSns).mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "sns-1",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const r = await sendIncidentMediaLinkSms({ ...baseEnv, smsProvider: "auto", smsPrimaryProvider: "twilio" }, baseArgs);
    expect(r.status).toBe("sent");
    expect(r.provider).toBe("aws");
    expect(r.smsFailoverUsed).toBe(true);
    expect(r.firstAttemptProvider).toBe("twilio");
    expect(aws.sendWithAwsSns).toHaveBeenCalledTimes(1);
  });

  it("auto with primary twilio does not fail over on non-retryable Twilio failure", async () => {
    vi.mocked(twilio.sendWithTwilio).mockResolvedValue({
      provider: "twilio",
      status: "failed",
      errorCode: "HTTP_400",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: false,
    });
    const r = await sendIncidentMediaLinkSms({ ...baseEnv, smsProvider: "auto" }, baseArgs);
    expect(r.status).toBe("failed");
    expect(r.provider).toBe("twilio");
    expect(aws.sendWithAwsSns).not.toHaveBeenCalled();
  });

  it("auto with primary aws fails over to Twilio on retryable AWS failure", async () => {
    vi.mocked(aws.sendWithAwsSns).mockResolvedValue({
      provider: "aws",
      status: "failed",
      errorCode: "Throttling",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: true,
    });
    vi.mocked(twilio.sendWithTwilio).mockResolvedValue({
      provider: "twilio",
      status: "sent",
      messageId: "SMz",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const r = await sendIncidentMediaLinkSms(
      { ...baseEnv, smsProvider: "auto", smsPrimaryProvider: "aws" },
      { ...baseArgs, messageType: "live_video" },
    );
    expect(r.status).toBe("sent");
    expect(r.provider).toBe("twilio");
    expect(r.smsFailoverUsed).toBe(true);
    expect(twilio.sendWithTwilio).toHaveBeenCalled();
  });
});
