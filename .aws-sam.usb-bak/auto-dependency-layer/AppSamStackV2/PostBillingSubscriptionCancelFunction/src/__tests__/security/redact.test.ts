import { describe, expect, it } from "vitest";
import { REDACTED, redactHeaders, redactUnknown, isSensitiveHeaderOrFieldName } from "../../security/redact.js";

describe("redact helpers", () => {
  it("marks sensitive header keys", () => {
    expect(isSensitiveHeaderOrFieldName("Authorization")).toBe(true);
    expect(isSensitiveHeaderOrFieldName("X-Request-Id")).toBe(false);
  });

  it("redacts headers map", () => {
    expect(
      redactHeaders({
        Authorization: "Bearer eyJ.fake",
        "x-request-id": "abc",
      }),
    ).toMatchObject({
      Authorization: REDACTED,
      "x-request-id": "abc",
    });
  });

  it("redacts nested credential keys in objects", () => {
    const out = redactUnknown({
      user: "u1",
      access_token: "nope",
      nested: { client_secret: "x" },
    }) as Record<string, unknown>;
    expect(out.access_token).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).client_secret).toBe(REDACTED);
  });
});
