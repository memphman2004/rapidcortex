import { describe, expect, it } from "vitest";
import {
  alertDispatchBodySchema,
  isConfirmDispatchToken,
  isVerticalAlertWsType,
  verticalAlertWsType,
} from "./schemas.js";

describe("occupant alert CONFIRM gate", () => {
  it("accepts case-insensitive CONFIRM", () => {
    expect(isConfirmDispatchToken("CONFIRM")).toBe(true);
    expect(isConfirmDispatchToken("confirm")).toBe(true);
    expect(isConfirmDispatchToken(" Confirm ")).toBe(true);
    expect(isConfirmDispatchToken("SEND")).toBe(false);
    expect(isConfirmDispatchToken("")).toBe(false);
  });

  it("requires confirmationToken or confirmation on the dispatch body", () => {
    const base = {
      vertical: "campus" as const,
      templateId: "tpl1",
      groupIds: ["g1"],
      channels: ["WEB_DASHBOARD" as const],
    };
    expect(alertDispatchBodySchema.safeParse({ ...base, confirmation: "yes" }).success).toBe(false);
    expect(alertDispatchBodySchema.safeParse({ ...base, confirmationToken: "CONFIRM" }).success).toBe(
      true,
    );
  });

  it("maps verticals to CAMPUS_ALERT / VENUE_ALERT / TRANSIT_ALERT", () => {
    expect(verticalAlertWsType("campus")).toBe("CAMPUS_ALERT");
    expect(verticalAlertWsType("venue")).toBe("VENUE_ALERT");
    expect(verticalAlertWsType("transit")).toBe("TRANSIT_ALERT");
    expect(isVerticalAlertWsType("CAMPUS_ALERT")).toBe(true);
    expect(isVerticalAlertWsType("VERTICAL_ALERT")).toBe(true);
    expect(isVerticalAlertWsType("staff-broadcast")).toBe(false);
  });
});
