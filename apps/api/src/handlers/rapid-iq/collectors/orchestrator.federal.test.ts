import { afterEach, describe, expect, it } from "vitest";
import { isFederalCollectorEnabled } from "./orchestrator.js";

describe("isFederalCollectorEnabled", () => {
  afterEach(() => {
    delete process.env.RAPID_IQ_INCLUDE_FEDERAL;
  });

  it("defaults off so city/county/state + Euna path stays non-federal", () => {
    delete process.env.RAPID_IQ_INCLUDE_FEDERAL;
    expect(isFederalCollectorEnabled()).toBe(false);
  });

  it("opts in only for true/1", () => {
    process.env.RAPID_IQ_INCLUDE_FEDERAL = "true";
    expect(isFederalCollectorEnabled()).toBe(true);
    process.env.RAPID_IQ_INCLUDE_FEDERAL = "1";
    expect(isFederalCollectorEnabled()).toBe(true);
    process.env.RAPID_IQ_INCLUDE_FEDERAL = "false";
    expect(isFederalCollectorEnabled()).toBe(false);
  });
});
