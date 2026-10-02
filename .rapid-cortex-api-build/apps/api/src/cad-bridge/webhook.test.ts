import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHttpHandler } from "../handlers/handlerTestUtils.js";
import { handleCadBridgeWebhook } from "./webhook.js";

const { getConfig, send } = vi.hoisted(() => ({
  getConfig: vi.fn(),
  send: vi.fn(async () => ({})),
}));

vi.mock("../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    enableCadBridge: true,
    cadBridgeConfigTable: "rapid-cortex-cad-bridge-config-test",
    cadBridgeQueueUrl: "https://sqs.us-east-1.amazonaws.com/1/q.fifo",
    cadBridgeMock: true,
    cadWritebackEnabled: false,
  },
}));

vi.mock("./store.js", () => ({
  isCadBridgeStoreConfigured: () => true,
  cadBridgeStore: {
    getConfig,
  },
}));

vi.mock("./secrets.js", () => ({
  resolveCadBridgeSecret: vi.fn(async () => "whsec"),
}));

vi.mock("./loop-guard.js", () => ({
  checkForLoop: vi.fn(async () => ({ isLoop: false })),
}));

vi.mock("./metrics.js", () => ({
  emitCadBridgeMetrics: vi.fn(),
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = send;
  },
  SendMessageCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

function event(opts: {
  path: string;
  body: string;
  signature?: string;
  headers?: Record<string, string>;
  agencyId?: string;
  slot?: string;
}) {
  return {
    rawPath: opts.path,
    pathParameters: { agencyId: opts.agencyId ?? "kcpd", slot: opts.slot ?? "cad-a" },
    headers: {
      "x-premierone-signature": opts.signature ?? "",
      ...opts.headers,
    },
    body: opts.body,
    requestContext: { http: { method: "POST" }, requestId: "req-1" },
  };
}

describe("CAD bridge webhook", () => {
  beforeEach(() => {
    getConfig.mockReset();
    send.mockClear();
    getConfig.mockResolvedValue({
      agencyId: "kcpd",
      enabled: true,
      cadA: {
        vendor: "MOTOROLA",
        inboundEnabled: true,
        webhookSigningSecretArn: "arn:aws:secretsmanager:us-east-1:1:secret:rapid-cortex/cad-bridge/a",
      },
      cadB: {
        vendor: "TYLER",
        inboundEnabled: true,
        webhookSigningSecretArn: "arn:aws:secretsmanager:us-east-1:1:secret:rapid-cortex/cad-bridge/b",
      },
    });
  });

  it("returns 401 on a bad signature", async () => {
    const body = JSON.stringify({ eventType: "INCIDENT_CREATED", incidentData: { incidentId: "P1-1" } });
    const res = await invokeHttpHandler(
      handleCadBridgeWebhook,
      event({
        path: "/api/public/cad-bridge/kcpd/cad-a/events",
        body,
        signature: "sha256=00",
      }) as never,
    );
    expect(res.statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("returns 200 and enqueues a valid Motorola event", async () => {
    const body = JSON.stringify({ eventType: "INCIDENT_CREATED", incidentData: { incidentId: "P1-1" } });
    const signature = `sha256=${createHmac("sha256", "whsec").update(body, "utf8").digest("hex")}`;
    const res = await invokeHttpHandler(
      handleCadBridgeWebhook,
      event({
        path: "/api/public/cad-bridge/kcpd/cad-a/events",
        body,
        signature,
      }) as never,
    );
    expect(res.statusCode).toBe(200);
    expect(send).toHaveBeenCalled();
  });

  it("returns 200 and does not enqueue RC-originated loop traffic", async () => {
    const body = JSON.stringify({ eventType: "COMMENT_ADDED", incidentData: { incidentId: "P1-1" } });
    const signature = `sha256=${createHmac("sha256", "whsec").update(body, "utf8").digest("hex")}`;
    const res = await invokeHttpHandler(
      handleCadBridgeWebhook,
      event({
        path: "/api/public/cad-bridge/kcpd/cad-a/events",
        body,
        signature,
        headers: { "x-rc-bridge-source": "RC_BRIDGE" },
      }) as never,
    );
    expect(res.statusCode).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});
