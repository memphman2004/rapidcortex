import { describe, it, expect } from "vitest";
import { classifyAwsSmsError } from "./awsSmsProvider.js";

describe("classifyAwsSmsError", () => {
  it("treats throttling as retryable", () => {
    const c = classifyAwsSmsError({ name: "Throttling", message: "Rate exceeded" });
    expect(c.retryable).toBe(true);
  });

  it("treats invalid phone / parameter as non-retryable", () => {
    const c = classifyAwsSmsError({ name: "InvalidParameter", message: "Invalid phone" });
    expect(c.retryable).toBe(false);
  });

  it("treats opt-out as non-retryable", () => {
    const c = classifyAwsSmsError({ name: "OptedOutException", message: "opted out" });
    expect(c.retryable).toBe(false);
  });
});
