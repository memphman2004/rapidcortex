import { describe, expect, it } from "vitest";
import { defaultEnsTestProgram, ensTestKindsDue } from "./ens-test-program.js";

describe("ensTestKindsDue", () => {
  it("returns monthly silent on configured day", () => {
    const program = defaultEnsTestProgram("campus", "agency-1", "Test U");
    program.monthlySilent.dayOfMonth = 15;
    program.monthlySilent.hourLocal = 9;
    program.monthlySilent.minuteLocal = 0;
    const due = ensTestKindsDue(program, "2026-03-15T14:00:00.000Z");
    expect(due).toContain("monthly_silent");
  });

  it("skips transit vertical", () => {
    const program = defaultEnsTestProgram("transit", "agency-1", "Transit");
    expect(ensTestKindsDue(program, "2026-03-15T14:00:00.000Z")).toEqual([]);
  });
});
