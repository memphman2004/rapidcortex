import { beforeEach, describe, expect, it, vi } from "vitest";

const { initiateSession, processUtterance, completeSession } = vi.hoisted(() => ({
  initiateSession: vi.fn(),
  processUtterance: vi.fn(),
  completeSession: vi.fn(),
}));

vi.mock("../../call-assist/session-pipeline.js", () => ({
  initiateSession,
  processUtterance,
  completeSession,
}));

vi.mock("../../call-assist/store.js", () => ({
  callAssistStore: {
    listSessions: vi.fn(async () => []),
    getSession: vi.fn(async () => null),
  },
}));

vi.mock("../../call-assist/config-service.js", () => ({
  getOrCreateConfig: vi.fn(async (agencyId: string) => ({
    agencyId,
    disclosureText: "This call may be recorded.",
    operatingHours: undefined,
    defaultLanguageCode: "en-US",
  })),
  isWithinOperatingHours: vi.fn(() => true),
}));

vi.mock("../../call-assist/transfer-ledger.js", () => ({
  closeOpenTransferAttempts: vi.fn(async () => []),
}));

vi.mock("../../call-assist/sms-self-service.js", () => ({
  completeSelfService: vi.fn(),
  markSelfServiceOpened: vi.fn(),
}));

vi.mock("../../call-assist/callback-campaign.js", () => ({
  decideCallbackOffer: vi.fn(() => ({ offer: false })),
}));

vi.mock("../../lib/runtimeSecrets.js", () => ({
  resolvePlainOrSecretArn: vi.fn(async () => "expected-secret"),
}));

vi.mock("../../lib/env.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../lib/env.js")>();
  return {
    env: {
      ...mod.env,
      enableCallAssist: true,
      callAssistTable: "test-call-assist",
      callAssistConnectMock: false,
      callAssistConnectWebhookSecret: "",
      callAssistConnectWebhookSecretArn: "arn:aws:secretsmanager:us-east-1:1:secret:x",
    },
  };
});

import { handler } from "./connectWebhook.js";
import { invokeHttpHandler } from "../handlerTestUtils.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

function makeWebhookEvent(opts: {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
  rawPath?: string;
}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/call-assist/connect/webhook",
    rawPath: opts.rawPath ?? "/api/call-assist/connect/webhook",
    rawQueryString: "",
    headers: opts.headers ?? { "x-call-assist-secret": "expected-secret" },
    requestContext: {
      accountId: "1",
      apiId: "api",
      domainName: "example.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "example",
      http: {
        method: opts.method ?? "POST",
        path: opts.rawPath ?? "/api/call-assist/connect/webhook",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "req",
      routeKey: "POST /api/call-assist/connect/webhook",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: opts.body,
  };
}

describe("Call Assist Connect webhook", () => {
  beforeEach(() => {
    initiateSession.mockReset();
    processUtterance.mockReset();
    completeSession.mockReset();
  });

  it("rejects missing webhook secret when mock is off", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeWebhookEvent({
        headers: {},
        body: JSON.stringify({
          eventType: "INITIATED",
          agencyId: "kcpd",
          contactId: "c-1",
        }),
      }),
    );
    expect(res.statusCode).toBe(401);
  });

  it("initiates a CONNECT session on INITIATED", async () => {
    initiateSession.mockResolvedValueOnce({
      sessionId: "sess-1",
      agencyId: "kcpd",
      source: "CONNECT",
      connectContactId: "c-1",
    });
    const res = await invokeHttpHandler(
      handler,
      makeWebhookEvent({
        body: JSON.stringify({
          eventType: "INITIATED",
          agencyId: "kcpd",
          contactId: "c-1",
          ani: "+18165550100",
        }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(initiateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "kcpd",
        source: "CONNECT",
        connectContactId: "c-1",
        ani: "+18165550100",
      }),
    );
    const body = JSON.parse(String(res.body ?? "{}")) as { telephony?: { greetingDelivered?: boolean } };
    expect(body.telephony?.greetingDelivered).toBe(true);
  });
});
