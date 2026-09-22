import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";
import { sendVideoAssistSms } from "./videoAssistSms.js";

vi.mock("../services/sms/smsProviderFactory.js", () => ({
  sendIncidentMediaLinkSms: vi.fn(),
}));

vi.mock("./smsFactoryEnv.js", () => ({
  buildSmsFactoryEnvForAgency: vi.fn(async () => ({
    smsProvider: "aws",
    deploymentStage: "dev",
    incidentMediaSmsMock: false,
    mockSmsProvider: false,
    awsRegion: "us-east-1",
  })),
}));

describe("sendVideoAssistSms", () => {
  beforeEach(() => {
    vi.mocked(sendIncidentMediaLinkSms).mockReset();
  });

  it("marks ok when AWS reports sent", async () => {
    vi.mocked(sendIncidentMediaLinkSms).mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "m-1",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const r = await sendVideoAssistSms({
      phoneE164: "+15555550100",
      message: "open this",
      agencyId: "agency-1",
      incidentId: "inc-1",
    });
    expect(r.ok).toBe(true);
    expect(r.provider).toBe("aws");
    expect(r.providerRef).toBe("m-1");
    expect(r.logOnly).toBeUndefined();
    expect(vi.mocked(sendIncidentMediaLinkSms).mock.calls[0]![1].messageType).toBe("live_video");
  });

  it("does not treat a failed send as ok", async () => {
    vi.mocked(sendIncidentMediaLinkSms).mockResolvedValue({
      provider: "aws",
      status: "failed",
      errorCode: "ACCESS_DENIED",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: false,
    });
    const r = await sendVideoAssistSms({
      phoneE164: "+15555550100",
      message: "open this",
      agencyId: "agency-1",
      incidentId: "inc-1",
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("ACCESS_DENIED");
  });

  it("builds a dispatcher-facing lastError when send fails", async () => {
    const { videoAssistSmsFailureMessage } = await import("./videoAssistSms.js");
    expect(videoAssistSmsFailureMessage({})).toBe(
      "The SMS was not sent. The caller did not receive a message.",
    );
    expect(videoAssistSmsFailureMessage({ errorCode: "ACCESS_DENIED" })).toContain("ACCESS_DENIED");
  });
});
