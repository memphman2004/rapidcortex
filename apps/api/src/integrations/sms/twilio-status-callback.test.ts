import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const AUTH_TOKEN = "twilio-auth-token";
const CALLBACK_URL = "https://api.example.test/api/sms/twilio/status";

const { smSend } = vi.hoisted(() => ({ smSend: vi.fn() }));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = smSend;
  },
  GetSecretValueCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

function sign(params: Record<string, string>, authToken = AUTH_TOKEN): string {
  let payload = CALLBACK_URL;
  for (const key of Object.keys(params).sort()) payload += key + params[key];
  return createHmac("sha1", authToken).update(Buffer.from(payload, "utf8")).digest("base64");
}

function event(params: Record<string, string>, signature?: string): APIGatewayProxyEventV2 {
  return {
    headers: signature === undefined ? {} : { "x-twilio-signature": signature },
    rawPath: "/api/sms/twilio/status",
    rawQueryString: "",
    body: new URLSearchParams(params).toString(),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

async function loadHandler() {
  vi.resetModules();
  const mod = await import("./twilio-status-callback.js");
  return mod.handler;
}

describe("twilio delivery receipt webhook", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("SMS_STATUS_CALLBACK_URL", CALLBACK_URL);
    vi.stubEnv("INCIDENT_MEDIA_TWILIO_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:0:secret:t");
    smSend.mockReset();
    smSend.mockResolvedValue({
      SecretString: JSON.stringify({
        accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        authToken: AUTH_TOKEN,
        messagingServiceSid: "MGcccccccccccccccccccccccccccccccc",
      }),
    });
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects a receipt with no Twilio signature", async () => {
    const handler = await loadHandler();
    await handler(event({ MessageStatus: "delivered" }), {} as never, {} as never);
    expect(warnSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("rejects a receipt signed with the wrong auth token", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "delivered" };
    const handler = await loadHandler();
    await handler(event(params, sign(params, "attacker")), {} as never, {} as never);
    expect(warnSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs a delivered receipt at info", async () => {
    const params = { MessageSid: "SM1", MessageStatus: "delivered" };
    const handler = await loadHandler();
    await handler(event(params, sign(params)), {} as never, {} as never);
    const logged = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(logged).toMatchObject({
      event: "delivery_receipt",
      providerStatus: "delivered",
      signatureVerified: true,
    });
  });

  it("logs a carrier-filtered receipt at error with the Twilio error code", async () => {
    const params = { MessageSid: "SM2", MessageStatus: "undelivered", ErrorCode: "30034" };
    const handler = await loadHandler();
    await handler(event(params, sign(params)), {} as never, {} as never);
    const logged = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(logged).toMatchObject({ providerStatus: "undelivered", errorCode: "30034" });
  });

  it("never logs the recipient phone number", async () => {
    const params = { MessageSid: "SM3", MessageStatus: "delivered", To: "+18085428061" };
    const handler = await loadHandler();
    await handler(event(params, sign(params)), {} as never, {} as never);
    expect(String(infoSpy.mock.calls[0]?.[0])).not.toContain("8085428061");
  });

  it("accepts but flags receipts when the secret has no auth token to verify against", async () => {
    smSend.mockResolvedValue({
      SecretString: JSON.stringify({
        accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        apiKeySid: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        apiKeySecret: "secret",
        messagingServiceSid: "MGcccccccccccccccccccccccccccccccc",
      }),
    });
    const params = { MessageSid: "SM4", MessageStatus: "delivered" };
    const handler = await loadHandler();
    await handler(event(params, "anything"), {} as never, {} as never);
    const logged = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(logged).toMatchObject({ providerStatus: "delivered", signatureVerified: false });
  });

  it("always acks so Twilio does not retry a rejected receipt", async () => {
    const handler = await loadHandler();
    const res = await handler(event({}), {} as never, {} as never);
    expect(res).toMatchObject({ statusCode: 204 });
  });
});
