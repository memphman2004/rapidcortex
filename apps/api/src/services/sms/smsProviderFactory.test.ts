import { describe, it, expect, vi, beforeEach } from "vitest";
import * as aws from "./awsSmsProvider.js";
import { sendIncidentMediaLinkSms, type SmsFactoryEnv } from "./smsProviderFactory.js";

vi.mock("./awsSmsProvider.js", () => ({
  sendWithAwsSms: vi.fn(),
}));

const baseEnv: SmsFactoryEnv = {
  smsProvider: "aws",
  deploymentStage: "prod",
  incidentMediaSmsMock: false,
  mockSmsProvider: false,
  awsRegion: "us-east-1",
  awsSmsRegion: "",
  awsSmsUseSimulator: false,
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
    vi.mocked(aws.sendWithAwsSms).mockReset();
  });

  it("uses mock when MOCK_SMS_PROVIDER is true", async () => {
    const r = await sendIncidentMediaLinkSms(
      { ...baseEnv, mockSmsProvider: true, smsProvider: "aws" },
      baseArgs,
    );
    expect(r.provider).toBe("mock");
    expect(aws.sendWithAwsSms).not.toHaveBeenCalled();
  });

  it("aws mode calls AWS only", async () => {
    vi.mocked(aws.sendWithAwsSms).mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "m1",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const r = await sendIncidentMediaLinkSms({ ...baseEnv, smsProvider: "aws" }, baseArgs);
    expect(r.status).toBe("sent");
    expect(r.provider).toBe("aws");
    expect(aws.sendWithAwsSms).toHaveBeenCalledTimes(1);
    expect(vi.mocked(aws.sendWithAwsSms).mock.calls[0]![0].messageType).toBe("media_upload");
  });
});
