import { describe, expect, it } from "vitest";
import {
  cadPushGateMessage,
  isCadPushBlockedByPictureStatus,
} from "./cad-push-gate.js";

describe("isCadPushBlockedByPictureStatus", () => {
  it("allows when no field-confidence analysis yet", () => {
    expect(isCadPushBlockedByPictureStatus(undefined)).toBe(false);
    expect(isCadPushBlockedByPictureStatus(null)).toBe(false);
  });

  it("allows COMPLETE and PARTIAL", () => {
    expect(isCadPushBlockedByPictureStatus("COMPLETE")).toBe(false);
    expect(isCadPushBlockedByPictureStatus("PARTIAL")).toBe(false);
  });

  it("blocks INCOMPLETE and CONFLICTED", () => {
    expect(isCadPushBlockedByPictureStatus("INCOMPLETE")).toBe(true);
    expect(isCadPushBlockedByPictureStatus("CONFLICTED")).toBe(true);
  });
});

describe("cadPushGateMessage", () => {
  it("mentions conflicts vs gaps", () => {
    expect(cadPushGateMessage("CONFLICTED")).toMatch(/conflict/i);
    expect(cadPushGateMessage("INCOMPLETE")).toMatch(/incomplete|gap/i);
  });
});
