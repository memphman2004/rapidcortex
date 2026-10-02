import { describe, expect, it } from "vitest";
import { signRcLiteWebhookBody, formatRcLiteWebhookSigHeader } from "rapid-cortex-shared/rc-lite/webhook-signing";
import { verifyCampusSecurityEventAuth } from "./campus-security-event-auth.js";

describe("verifyCampusSecurityEventAuth", () => {
  const secret = "test-campus-webhook-secret";
  const body = JSON.stringify({ campusCode: "IU", source: "alarm", type: "security" });

  it("accepts a valid HMAC signature", () => {
    process.env.CAMPUS_SECURITY_EVENT_WEBHOOK_SECRET = secret;
    delete process.env.ENABLE_CAMPUS_SECURITY_EVENTS_MOCK;
    const ts = Math.floor(Date.now() / 1000);
    const sig = formatRcLiteWebhookSigHeader("v1", signRcLiteWebhookBody(secret, ts, body));
    const result = verifyCampusSecurityEventAuth(
      {
        headers: {
          "x-rapidcortex-timestamp": String(ts),
          "x-rapidcortex-signature": sig,
        },
      },
      body,
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts a shared token", () => {
    process.env.CAMPUS_SECURITY_EVENT_WEBHOOK_SECRET = secret;
    delete process.env.ENABLE_CAMPUS_SECURITY_EVENTS_MOCK;
    const result = verifyCampusSecurityEventAuth({ headers: { "x-rc-token": secret } }, body);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a bad signature", () => {
    process.env.CAMPUS_SECURITY_EVENT_WEBHOOK_SECRET = secret;
    delete process.env.ENABLE_CAMPUS_SECURITY_EVENTS_MOCK;
    const ts = Math.floor(Date.now() / 1000);
    const result = verifyCampusSecurityEventAuth(
      {
        headers: {
          "x-rapidcortex-timestamp": String(ts),
          "x-rapidcortex-signature": "v1=" + "ab".repeat(32),
        },
      },
      body,
    );
    expect(result.ok).toBe(false);
  });
});
