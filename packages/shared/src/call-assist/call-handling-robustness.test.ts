import { describe, expect, it } from "vitest";
import { classifyMunicipalIssue } from "./municipal-services.js";
import { listedReasonReplacesIntent } from "./citizen-call-reasons.js";
import { evaluateSafety } from "./safety.js";
import { findSameDayReport, locationReadback, municipalAfterHoursNote } from "./location-readback.js";
import { callerTextForSafety } from "../../../../apps/api/src/call-assist/lex/safety-gate.js";

describe("caller reasons in every Nexiq language", () => {
  it.each([
    ["throw away needles", "SANITATION"],
    ["donde tiro las agujas", "SANITATION"],
    ["针头怎么扔", "SANITATION"],
    ["針頭點丟", "SANITATION"],
    ["saan itatapon ang karayom", "SANITATION"],
    ["bỏ kim tiêm ở đâu", "SANITATION"],
    ["أين أرمي الإبر", "SANITATION"],
    ["où jeter les seringues", "SANITATION"],
    ["冇水", "WATER_SEWER_AUTHORITY"],
    ["se fue el agua", "WATER_SEWER_AUTHORITY"],
  ])("%s goes to %s", (utterance, departmentId) => {
    expect(classifyMunicipalIssue(utterance)?.departmentId).toBe(departmentId);
  });

  it("lets a sanitation reason replace a noise guess and keeps a police reason on the police desk", () => {
    expect(listedReasonReplacesIntent("NoiseComplaint", "SANITATION")).toBe(true);
    expect(listedReasonReplacesIntent("NonEmergencyPolice", "POLICE_NON_EMERGENCY")).toBe(false);
  });
});

describe("call safety across turns", () => {
  it("treats a gun mentioned earlier as an emergency", () => {
    const text = callerTextForSafety("Caller: he has a gun|Assistant: where is he?", "on oak street");
    expect(evaluateSafety(text).action).toBe("TRANSFER_911");
  });

  it("does not transfer when the caller says it is not an emergency", () => {
    expect(evaluateSafety("this is not an emergency, the trash was missed").action).toBe("CONTINUE");
  });

  it("still transfers for a gun even if they also say it is not an emergency", () => {
    expect(evaluateSafety("this is not an emergency he has a gun").action).toBe("TRANSFER_911");
  });
});

describe("location, duplicates, and office hours", () => {
  it("reads an intersection back", () => {
    expect(locationReadback("12th and Main")).toMatch(/12th and Main/);
    expect(locationReadback("12th and Main", "es")).toMatch(/ubicación/i);
  });

  it("finds a report already filed today for the same number and place", () => {
    const hit = findSameDayReport(
      [
        {
          sessionId: "older",
          createdAt: "2026-10-28T15:00:00.000Z",
          callbackNumber: "+18165550142",
          locationText: "12th and Main",
        },
      ],
      {
        sessionId: "current",
        now: "2026-10-28T18:00:00.000Z",
        callbackNumber: "816-555-0142",
        locationText: "12th & Main",
      },
    );
    expect(hit?.sessionId).toBe("older");
  });

  it("says the office is closed in the evening and stays quiet during the workday", () => {
    expect(municipalAfterHoursNote(new Date("2026-10-28T23:00:00.000Z"), "America/Chicago", "en")).toMatch(/closed/i);
    expect(municipalAfterHoursNote(new Date("2026-10-28T15:00:00.000Z"), "America/Chicago", "en")).toBeNull();
    expect(municipalAfterHoursNote(new Date("2026-10-28T23:00:00.000Z"), "America/Chicago", "vi")).toMatch(/đóng cửa/i);
  });
});
