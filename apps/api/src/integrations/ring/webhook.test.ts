import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

function generateWebhookSignature(rawBody: string, signingKey: string): string {
  const hex = createHmac("sha256", Buffer.from(signingKey, "utf-8"))
    .update(rawBody)
    .digest("hex");
  return `sha256=${hex}`;
}

describe("ring webhook signature contract", () => {
  it("matches Ring hex sha256= encoding", () => {
    const body = JSON.stringify({
      meta: { version: "1.1", request_id: "req-1", account_id: "acct-1" },
      data: {
        id: "evt-1",
        type: "device_removed",
        attributes: { source: "dev-1", source_type: "devices", timestamp: 1 },
      },
    });
    const key = "test-hmac-key";
    const sig = generateWebhookSignature(body, key);
    expect(sig.startsWith("sha256=")).toBe(true);
    const expected = createHmac("sha256", key).update(body).digest("hex");
    expect(sig).toBe(`sha256=${expected}`);
  });
});
