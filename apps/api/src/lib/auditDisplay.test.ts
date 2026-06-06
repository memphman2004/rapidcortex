import { describe, expect, it } from "vitest";
import type { AuditEvent } from "rapid-cortex-shared";
import { normalizeAuditEventForApi } from "./auditDisplay.js";

describe("normalizeAuditEventForApi", () => {
  it("redacts sensitive detail keys", () => {
    const e: AuditEvent = {
      eventId: "e1",
      agencyId: "a1",
      type: "admin.user.create",
      details: { email: "u@x.com", temporaryPassword: "Secret123!" },
      createdAt: new Date().toISOString(),
    };
    const n = normalizeAuditEventForApi(e);
    expect(n.details.temporaryPassword).toBe("[redacted]");
    expect(n.details.email).toBe("u@x.com");
  });
});
