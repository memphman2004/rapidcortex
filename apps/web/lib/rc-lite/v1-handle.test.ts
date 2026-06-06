import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { clearRcLiteMeterSmokeBuffer, readRcLiteMeterSmokeBuffer } from "./metering-log";
import { resetIdempotentEntriesForTests } from "./idempotency-memory";
import { hashRcLiteApiKey } from "./hash-api-key";
import { handleRcLiteV1Request } from "./v1-handle";

describe("handleRcLiteV1Request › idempotent replay metering", () => {
  beforeEach(() => {
    process.env.ALLOW_RC_LITE_DEV_KEYS = "true";
    clearRcLiteMeterSmokeBuffer();
    resetIdempotentEntriesForTests();
  });

  it("records only one authoritative meter row when replays replay", async () => {
    const segments = ["intelligence", "analyze-incident"];
    const body = '{"scenario":"domestic_disturbance"}';

    async function invoke() {
      return handleRcLiteV1Request(
        new NextRequest("http://localhost/api/v1/intelligence/analyze-incident", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-rc-api-key": "rk_test_meter",
            "idempotency-key": "meter-suite-stable",
          },
          body,
        }),
        segments,
        "POST",
      );
    }

    const responseA = await invoke();
    const responseB = await invoke();
    const textA = await responseA.clone().text();
    const textB = await responseB.clone().text();

    expect(responseA.status).toBe(501);
    expect(responseB.status).toBe(501);
    expect(textA).toBe(textB);

    const telemetry = readRcLiteMeterSmokeBuffer();
    expect(telemetry.some((meter) => meter.idempotentReplay)).toBe(true);
    expect(telemetry.filter((meter) => !meter.idempotentReplay && meter.endpoint === "intelligence/analyze-incident")).toHaveLength(
      1,
    );
  });

  it("returns 409 when idempotency key collides with different bodies", async () => {
    const headers = new Headers({
      "content-type": "application/json",
      "x-rc-api-key": "rk_test_conflict",
      "idempotency-key": `idem_${randomUUID()}`,
    });

    await handleRcLiteV1Request(
      new NextRequest("http://localhost/api/v1/translation/text", {
        method: "POST",
        headers,
        body: '{"pass":1}',
      }),
      ["translation", "text"],
      "POST",
    );

    const conflictResponse = await handleRcLiteV1Request(
      new NextRequest("http://localhost/api/v1/translation/text", {
        method: "POST",
        headers,
        body: '{"pass":2}',
      }),
      ["translation", "text"],
      "POST",
    );

    expect(conflictResponse.status).toBe(409);
    const envelope = JSON.parse(await conflictResponse.text()) as { error?: { code?: string } };
    expect(envelope.error?.code).toBe("idempotency_conflict");
  });
});

describe("handleRcLiteV1Request › hashed canary lookups", () => {
  beforeEach(() => {
    process.env.ALLOW_RC_LITE_DEV_KEYS = "true";
    clearRcLiteMeterSmokeBuffer();
    resetIdempotentEntriesForTests();
  });

  afterEach(() => {
    delete process.env.RC_LITE_CANARY_HASH_HEX;
    delete process.env.RC_LITE_CANARY_TENANT_ID;
  });

  it("accepts KMS-style hashes through the dev verifier", async () => {
    const plaintext = `rk_hmac_${randomUUID()}`;
    process.env.RC_LITE_CANARY_HASH_HEX = hashRcLiteApiKey(plaintext);
    process.env.RC_LITE_CANARY_TENANT_ID = "tenant_hmac_demo";

    const res = await handleRcLiteV1Request(
      new NextRequest("http://localhost/api/v1/translation/text", {
        method: "POST",
        headers: {
          authorization: `Bearer ${plaintext}`,
          "content-type": "application/json",
          "idempotency-key": `idem_${randomUUID()}`,
        },
        body: '{"text":"¿Hay alguien herido?"}',
      }),
      ["translation", "text"],
      "POST",
    );

    expect(res.status).toBe(501);
    const json = JSON.parse(await res.clone().text()) as { tenantId?: string };
    expect(json.tenantId).toBe("tenant_hmac_demo");
  });
});
