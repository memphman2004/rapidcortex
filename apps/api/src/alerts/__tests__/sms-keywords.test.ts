import { describe, expect, it } from "vitest";
import { isStartKeyword, isStopKeyword } from "../sms-keywords.js";

describe("short-code STOP/START keywords", () => {
  it("treats STOP family as opt-out", () => {
    expect(isStopKeyword("STOP")).toBe(true);
    expect(isStopKeyword("unsubscribe")).toBe(true);
    expect(isStartKeyword("START")).toBe(true);
    expect(isStopKeyword("hello")).toBe(false);
  });
});
