import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyTwilioHttpResponse, loadTwilioSecret, sendWithTwilio } from "./twilioSmsProvider.js";

const { smSend } = vi.hoisted(() => ({ smSend: vi.fn() }));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = smSend;
  },
  GetSecretValueCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

describe("classifyTwilioHttpResponse", () => {
  it("marks 5xx as retryable", () => {
    expect(classifyTwilioHttpResponse(503, "").retryable).toBe(true);
  });
  it("marks 400 as non-retryable", () => {
    expect(classifyTwilioHttpResponse(400, "").retryable).toBe(false);
  });
});

describe("twilioSmsProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    smSend.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock as typeof fetch);
  });

  it("loads API key + messaging service JSON", async () => {
    smSend.mockResolvedValue({
      SecretString: JSON.stringify({
        accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        apiKeySid: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        apiKeySecret: "secret",
        messagingServiceSid: "MGcccccccccccccccccccccccccccccccc",
      }),
    });
    const secret = await loadTwilioSecret("arn:aws:secretsmanager:us-east-1:0:secret:test");
    expect(secret).not.toBeNull();
    expect(secret && "apiKeySid" in secret).toBe(true);
  });

  it("sends via Messaging Service SID using API key auth", async () => {
    smSend.mockResolvedValue({
      SecretString: JSON.stringify({
        accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        apiKeySid: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        apiKeySecret: "secret",
        messagingServiceSid: "MGcccccccccccccccccccccccccccccccc",
      }),
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sid: "SMzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" }), { status: 201 }));

    const r = await sendWithTwilio({
      secretArn: "arn:aws:secretsmanager:us-east-1:0:secret:test",
      toPhoneE164: "+15555550100",
      messageBody: "hi",
      agencyId: "a",
      incidentId: "i",
      messageType: "media_upload",
    });

    expect(r.status).toBe("sent");
    expect(r.messageId).toBe("SMzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(String(init.body)).toContain("MessagingServiceSid=MGcccccccccccccccccccccccccccccccc");
  });
});
