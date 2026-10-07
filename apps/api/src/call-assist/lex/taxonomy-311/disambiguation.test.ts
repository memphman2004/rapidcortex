import { describe, expect, it } from "vitest";
import { DISAMBIGUATION_RULES } from "./disambiguation.js";
import { INTENT_MAP } from "./intents.js";
import { SLOT_VALUE_LABELS, conversationalSlotValue } from "./slot-value-labels.js";
import { SMS_HELP_MESSAGE, smsClosingForIntent } from "../../sms-channel/sms-copy.js";

function run(intent: string, transcript: string) {
  const rule = DISAMBIGUATION_RULES.find((r) => r.intentName === intent);
  if (!rule) throw new Error(`missing rule ${intent}`);
  return rule.check(transcript);
}

const REPORT_INTENTS = Object.keys(INTENT_MAP).filter(
  (name) => name !== "TransferToLiveAgent" && name !== "RedirectToEmergencyServices",
);

describe("311 disambiguation", () => {
  it("has a rule for every 311 report/info intent", () => {
    const covered = new Set(DISAMBIGUATION_RULES.map((r) => r.intentName));
    const missing = REPORT_INTENTS.filter((name) => !covered.has(name));
    expect(missing).toEqual([]);
  });

  it("infers pothole vs sinkhole", () => {
    expect(run("ReportRoadsInfrastructure", "There is a pothole on Main Street")?.inferredSubIssue).toBe(
      "POTHOLE",
    );
    expect(run("ReportRoadsInfrastructure", "The road is collapsing into a sinkhole")?.elevated).toBe(true);
  });

  it("asks when water on the street is ambiguous", () => {
    const r = run("ReportWaterSewerDrainage", "There is water on my street");
    expect(r?.clarificationQuestion).toMatch(/bubbling/i);
  });

  it("maps barking dog to animal control sub-issue", () => {
    expect(run("ReportNoiseComplaint", "My neighbor's dog won't stop barking")?.inferredSubIssue).toBe(
      "DOG_BARKING",
    );
  });

  it("infers common SMS phrases without using slot names", () => {
    expect(run("ReportStreetLighting", "The streetlight is out")?.inferredSubIssue).toBe(
      "STREETLIGHT_OUT_SINGLE",
    );
    expect(run("ReportSanitationWaste", "They skipped my trash")?.inferredSubIssue).toBe(
      "MISSED_GARBAGE_PICKUP",
    );
    expect(run("ReportVehicleIssue", "Car blocking my driveway")?.inferredSubIssue).toBe(
      "VEHICLE_BLOCKING_DRIVEWAY",
    );
    expect(run("ReportTrafficSignsMarkings", "The stop sign is missing")?.inferredSubIssue).toBe(
      "MISSING_STOP_SIGN",
    );
    expect(run("RequestGovernmentInformation", "What are the hours for city hall")?.inferredSubIssue).toBe(
      "CITY_OFFICE_HOURS_LOCATION",
    );
  });

  it("never puts camelCase slot names in clarification questions", () => {
    for (const rule of DISAMBIGUATION_RULES) {
      const q = rule.check("xyzzy unclear")?.clarificationQuestion;
      if (q) expect(q).not.toMatch(/[A-Z][a-z]+[A-Z]/);
    }
  });
});

describe("spoken slot labels", () => {
  it("covers every taxonomy slot value with conversational copy", () => {
    expect(conversationalSlotValue("FALLEN_TREE_ROAD")).toBe("fallen tree in the road");
    expect(conversationalSlotValue("STREETLIGHT_OUT_SINGLE")).toMatch(/streetlight/i);
    expect(SLOT_VALUE_LABELS.POTHOLE).toBeTruthy();
    expect(conversationalSlotValue("PUBLIC_WORKS")).toBe("Public Works");
  });
});

describe("SMS closings", () => {
  it("uses confirmation numbers and never says please hold", () => {
    const text = smsClosingForIntent("ReportTreesVegetation", "KC-1007-ABCD");
    expect(text).toContain("KC-1007-ABCD");
    expect(text).not.toMatch(/please hold|stay on the line|IsOngoing|TreeSubIssue/i);
    expect(SMS_HELP_MESSAGE).toMatch(/Pothole/i);
  });
});
