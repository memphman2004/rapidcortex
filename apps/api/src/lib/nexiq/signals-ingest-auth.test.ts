import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const resolvePlainOrSecretArn = vi.fn();

vi.mock("../runtimeSecrets.js", () => ({
  resolvePlainOrSecretArn: (...args: unknown[]) => resolvePlainOrSecretArn(...args),
}));

import {
  assertNexiqSignalsApiKey,
  extractNexiqSignalsApiKey,
} from "./signals-ingest-auth.js";

function eventWithHeaders(headers: Record<string, string>): APIGatewayProxyEventV2 {
  return { headers } as APIGatewayProxyEventV2;
}

describe("signals-ingest-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXIQ_SIGNALS_INGEST_API_KEY_SECRET_ARN;
    delete process.env.NEXIQ_SIGNALS_INGEST_API_KEY;
  });

  it("extracts x-nexcort-signals-key, x-api-key, or Bearer", () => {
    expect(
      extractNexiqSignalsApiKey(eventWithHeaders({ "x-nexcort-signals-key": "a" })),
    ).toBe("a");
    expect(extractNexiqSignalsApiKey(eventWithHeaders({ "x-api-key": "b" }))).toBe("b");
    expect(
      extractNexiqSignalsApiKey(eventWithHeaders({ authorization: "Bearer c" })),
    ).toBe("c");
  });

  it("accepts matching Secrets Manager key", async () => {
    process.env.NEXIQ_SIGNALS_INGEST_API_KEY_SECRET_ARN =
      "arn:aws:secretsmanager:us-east-1:1:secret:nexiq-signals";
    resolvePlainOrSecretArn.mockResolvedValue("secret-key-value");
    const r = await assertNexiqSignalsApiKey(
      eventWithHeaders({ "x-api-key": "secret-key-value" }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("rejects mismatched key", async () => {
    process.env.NEXIQ_SIGNALS_INGEST_API_KEY = "expected";
    const r = await assertNexiqSignalsApiKey(eventWithHeaders({ "x-api-key": "wrong" }));
    expect(r).toEqual({ ok: false, reason: "invalid_api_key" });
  });
});
