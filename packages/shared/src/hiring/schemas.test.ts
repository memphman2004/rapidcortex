import { describe, expect, it } from "vitest";
import {
  careersApplyBodySchema,
  EMAIL_TRIGGERS,
  updateApplicationBodySchema,
} from "./schemas.js";

describe("hiring schemas", () => {
  it("accepts a valid careers apply body", () => {
    const parsed = careersApplyBodySchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      coverNote: "I have twenty characters here.",
      resumeKey: "resumes/2026/abc.pdf",
      resumeFileName: "ada.pdf",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.position).toBe("EA_STARTUP_OPS_COORDINATOR");
      expect(parsed.data.source).toBe("CAREERS_PAGE");
    }
  });

  it("rejects short cover notes when provided", () => {
    const parsed = careersApplyBodySchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      coverNote: "too short",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps customMessage and statusNote separate on status updates", () => {
    const parsed = updateApplicationBodySchema.safeParse({
      status: "PHONE_SCREEN",
      statusNote: "internal only",
      customMessage: "Looking forward to chatting",
      schedulingLink: "https://calendly.com/example/phone",
      skipEmail: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.statusNote).toBe("internal only");
      expect(parsed.data.customMessage).toBe("Looking forward to chatting");
      expect(parsed.data.statusNote).not.toBe(parsed.data.customMessage);
    }
  });

  it("marks email trigger statuses", () => {
    expect(EMAIL_TRIGGERS.has("REJECTED")).toBe(true);
    expect(EMAIL_TRIGGERS.has("PHONE_SCREEN")).toBe(true);
    expect(EMAIL_TRIGGERS.has("INTERVIEW")).toBe(true);
    expect(EMAIL_TRIGGERS.has("OFFER")).toBe(true);
    expect(EMAIL_TRIGGERS.has("REVIEWING")).toBe(false);
    expect(EMAIL_TRIGGERS.has("HIRED")).toBe(false);
  });
});
