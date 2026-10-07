import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SNSEvent } from "aws-lambda";

vi.mock("../lex/runtime-store.js", () => ({
  getAgencyIdByDid: vi.fn(async () => "kcpd"),
  getLexTenantConfig: vi.fn(async () => ({
    agencyId: "kcpd",
    agencyName: "Kansas City",
    agencyShortName: "KCPD",
    shortName: "KCPD",
  })),
  normalizeCallAssistDid: (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return phone.startsWith("+") ? phone : `+${digits}`;
  },
}));

vi.mock("./session-store.js", () => ({
  isNewCaller: vi.fn(async () => false),
  isOptedOut: vi.fn(async () => false),
  isSessionIdle: vi.fn(async () => false),
  getSmsSession: vi.fn(async () => null),
  touchSession: vi.fn(async () => undefined),
  recordOptOut: vi.fn(async () => undefined),
  recordOptIn: vi.fn(async () => undefined),
}));

vi.mock("./lex-sms-client.js", () => ({
  sendToLex: vi.fn(async () => ({
    messages: [{ contentType: "PlainText", content: "Your report number is KC-1001-7M4R." }],
    sessionAttributes: { confirmationNumber: "KC-1001-7M4R", departmentId: "public_works" },
    intentName: "PublicWorksIssue",
    intentState: "Fulfilled",
    dialogActionType: "Close",
    sessionEnded: true,
  })),
  resetLexSession: vi.fn(async () => undefined),
}));

vi.mock("./sms-sender.js", () => ({
  sendSmsSegments: vi.fn(async () => undefined),
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

import { handleInboundSmsEvent } from "./handler.js";
import { sendSmsSegments } from "./sms-sender.js";
import { sendToLex } from "./lex-sms-client.js";
import { classifyKeyword } from "./compliance.js";

function snsEvent(body: string): SNSEvent {
  return {
    Records: [
      {
        EventSource: "aws:sns",
        EventVersion: "1.0",
        EventSubscriptionArn: "arn:aws:sns:us-east-1:1:t",
        Sns: {
          Type: "Notification",
          MessageId: "1",
          TopicArn: "arn:aws:sns:us-east-1:1:t",
          Subject: "",
          Timestamp: "2026-10-04T00:00:00.000Z",
          SignatureVersion: "1",
          Signature: "x",
          SigningCertUrl: "",
          UnsubscribeUrl: "",
          MessageAttributes: {},
          Message: JSON.stringify({
            originationNumber: "+18165550123",
            destinationNumber: "+13198358230",
            messageBody: body,
            inboundMessageId: "in-1",
          }),
        },
      },
    ],
  };
}

describe("311 SMS inbound handler", () => {
  beforeEach(() => {
    vi.mocked(sendSmsSegments).mockClear();
    vi.mocked(sendToLex).mockClear();
    process.env.ENABLE_CALL_ASSIST_SMS_CHANNEL = "true";
    process.env.CALL_ASSIST_SMS_TRANSLATE_MOCK = "true";
  });

  it("sends the same confirmation format after Lex fulfillment", async () => {
    await handleInboundSmsEvent(snsEvent("yes"));
    expect(sendToLex).toHaveBeenCalled();
    expect(sendSmsSegments).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "call_assist_confirmation",
        message: expect.stringContaining("Confirmation: KC-1001-7M4R"),
      }),
    );
  });

  it("does not treat YES as a START keyword", () => {
    expect(classifyKeyword("yes")).toBe("NONE");
  });

  it("sends Spanish replies when the inbound text is Spanish", async () => {
    vi.mocked(sendToLex).mockResolvedValueOnce({
      messages: [{ contentType: "PlainText", content: "What's the address or nearest intersection?" }],
      sessionAttributes: {},
      intentName: "ReportRoadsInfrastructure",
      intentState: "InProgress",
      dialogActionType: "ElicitSlot",
      sessionEnded: false,
    });
    await handleInboundSmsEvent(snsEvent("Hay un bache en la calle"));
    expect(sendToLex).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/pothole|street/i),
        sessionAttributes: expect.objectContaining({ language: "es", channel: "sms" }),
      }),
    );
    expect(sendSmsSegments).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/direcci[oó]n|intersecci[oó]n/i),
      }),
    );
  });
});
