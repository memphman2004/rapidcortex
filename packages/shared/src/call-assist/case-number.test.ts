import { describe, expect, it } from "vitest";
import {
  CALL_ASSIST_CONFIRMATION_CHARSET,
  callAssistConfirmationPrefix,
  formatCallAssistCaseNumber,
  formatConfirmationForSpeech,
  isCallAssistConfirmationNumber,
} from "./case-number.js";

describe("Call Assist confirmation numbers", () => {
  it("uses KC prefix for KCPD and PREFIX-MMDD-XXXX shape", () => {
    expect(callAssistConfirmationPrefix("kcpd")).toBe("KC");
    const id = formatCallAssistCaseNumber({
      agencyId: "kcpd",
      at: new Date("2026-10-01T16:20:36Z"),
      timeZone: "America/Chicago",
      suffix: "7M4R",
    });
    expect(id).toBe("KC-1001-7M4R");
    expect(isCallAssistConfirmationNumber(id)).toBe(true);
  });

  it("respects configured confirmationPrefix", () => {
    const id = formatCallAssistCaseNumber({
      agencyId: "other",
      confirmationPrefix: "FC",
      at: new Date("2026-01-02T12:00:00Z"),
      timeZone: "UTC",
      suffix: "ACDE",
    });
    expect(id).toBe("FC-0102-ACDE");
  });

  it("only uses the safe telephone charset", () => {
    const id = formatCallAssistCaseNumber({
      agencyId: "kcpd",
      at: new Date("2026-10-01T12:00:00Z"),
      timeZone: "UTC",
      rng: () => 0.99,
    });
    const suffix = id.split("-")[2]!;
    for (const ch of suffix) {
      expect(CALL_ASSIST_CONFIRMATION_CHARSET).toContain(ch);
    }
    expect(suffix).not.toMatch(/[01ILOSB58]/);
  });

  it("formats NATO speech for Polly", () => {
    expect(formatConfirmationForSpeech("KC-1001-7M4R")).toBe(
      "K, C, one zero zero one, seven Mike four Romeo",
    );
  });

  it("accepts legacy case number shapes for dual-read", () => {
    expect(isCallAssistConfirmationNumber("KCNE-09/16/2026-11:20:36-847291036512")).toBe(true);
    expect(isCallAssistConfirmationNumber("RC-CASE1234")).toBe(true);
  });
});
