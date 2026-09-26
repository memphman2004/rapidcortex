import { describe, expect, it } from "vitest";
import { isEnsTestProgramEnabled, isFourwindsEnabled } from "./runtime-flags";

describe("ENS runtime flags", () => {
  it("defaults ENS test program on when unset", () => {
    expect(isEnsTestProgramEnabled()).toBe(true);
  });

  it("defaults Four Winds on when unset", () => {
    expect(isFourwindsEnabled()).toBe(true);
  });
});
