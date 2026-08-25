import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCK_STATE,
  DOCK_MODULES,
  dockRowClass,
  reduceDock,
} from "./module-dock";

describe("module dock reducer", () => {
  it("lists modules in the specified picker order", () => {
    expect(DOCK_MODULES.map((m) => m.label)).toEqual([
      "Transcript",
      "Incident Picture",
      "Caller Mobile",
      "Silent Text Link",
      "Rapid Cortex Pinpoint",
      "Location",
      "Premise Notice",
      "Map",
    ]);
  });

  it("starts empty so the center pane stays blank until a module is opened", () => {
    expect(DEFAULT_DOCK_STATE).toEqual({
      leftSlot: null,
      rightSlot: null,
      split: false,
      focusedSlot: "left",
    });
  });

  it("opens into the left pane when split is off", () => {
    const opened = reduceDock(DEFAULT_DOCK_STATE, { type: "open", key: "transcript" });
    expect(opened.leftSlot).toBe("transcript");
    expect(opened.rightSlot).toBeNull();
    expect(opened.split).toBe(false);
    expect(opened.focusedSlot).toBe("left");

    const replaced = reduceDock(opened, { type: "open", key: "map" });
    expect(replaced.leftSlot).toBe("map");
    expect(replaced.rightSlot).toBeNull();
  });

  it("fills the empty side when split is on", () => {
    const splitEmpty = reduceDock(DEFAULT_DOCK_STATE, { type: "toggleSplit" });
    expect(splitEmpty.split).toBe(true);
    expect(splitEmpty.leftSlot).toBeNull();
    expect(splitEmpty.rightSlot).toBeNull();
    expect(splitEmpty.focusedSlot).toBe("right");

    const left = reduceDock(splitEmpty, { type: "open", key: "caller_mobile" });
    expect(left.leftSlot).toBe("caller_mobile");
    expect(left.rightSlot).toBeNull();

    const withRight = reduceDock(left, { type: "open", key: "silent_text" });
    expect(withRight.leftSlot).toBe("caller_mobile");
    expect(withRight.rightSlot).toBe("silent_text");
    expect(withRight.focusedSlot).toBe("right");
  });

  it("fills the vacant pane even if the occupied pane is focused", () => {
    const split = reduceDock(
      { leftSlot: "transcript", rightSlot: null, split: true, focusedSlot: "left" },
      { type: "open", key: "map" },
    );
    expect(split.leftSlot).toBe("transcript");
    expect(split.rightSlot).toBe("map");
    expect(split.focusedSlot).toBe("right");
  });

  it("replaces the focused pane once both sides are filled", () => {
    const both = {
      leftSlot: "transcript" as const,
      rightSlot: "map" as const,
      split: true,
      focusedSlot: "left" as const,
    };
    const replaced = reduceDock(both, { type: "open", key: "location" });
    expect(replaced.leftSlot).toBe("location");
    expect(replaced.rightSlot).toBe("map");
  });

  it("focuses the empty right pane when enabling split", () => {
    const split = reduceDock(
      { leftSlot: "transcript", rightSlot: null, split: false, focusedSlot: "left" },
      { type: "toggleSplit" },
    );
    expect(split.split).toBe(true);
    expect(split.focusedSlot).toBe("right");
  });

  it("restores a previous right module when re-enabling split", () => {
    const split = reduceDock(
      { leftSlot: "transcript", rightSlot: "map", split: true, focusedSlot: "left" },
      { type: "toggleSplit" },
    );
    expect(split.split).toBe(false);
    expect(split.focusedSlot).toBe("left");
    const splitAgain = reduceDock(split, { type: "toggleSplit" });
    expect(splitAgain.split).toBe(true);
    expect(splitAgain.rightSlot).toBe("map");
  });

  it("swaps slots", () => {
    const swapped = reduceDock(
      { leftSlot: "caller_mobile", rightSlot: "silent_text", split: true, focusedSlot: "left" },
      { type: "swap" },
    );
    expect(swapped.leftSlot).toBe("silent_text");
    expect(swapped.rightSlot).toBe("caller_mobile");
    expect(swapped.focusedSlot).toBe("right");
  });

  it("marks picker rows for left and right slots", () => {
    expect(dockRowClass("caller_mobile", "silent_text", "caller_mobile", true)).toContain("in-left");
    expect(dockRowClass("caller_mobile", "silent_text", "silent_text", true)).toContain("in-right");
    expect(dockRowClass("map", "map", "map", true)).toContain("in-left in-right");
  });
});
