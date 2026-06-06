import { describe, expect, it } from "vitest";
import { marketingOperationsStatusPath } from "@/lib/marketing-links";

describe("marketingOperationsStatusPath", () => {
  it("links in-app Status to /status", () => {
    expect(marketingOperationsStatusPath()).toBe("/status");
  });
});
