import { describe, expect, it } from "vitest";
import {
  applyConversationTurn,
  spokenCorrectionAck,
} from "./conversation-memory.js";
import { extractIntakeFields, utteranceHasCorrectionCue } from "./intake.js";

describe("Call Assist Phase 2 — conversation memory", () => {
  it("retains prior fields across turns and does not re-collect location", () => {
    const turn1 = applyConversationTurn({
      prior: {},
      utterance: "I'm at 1520 Main and there's a black Honda Accord",
    });
    expect(turn1.intake.locationText).toMatch(/1520 Main/i);
    expect(turn1.intake.vehicleMake?.toLowerCase()).toBe("honda");
    expect(turn1.collectedFields).toContain("locationText");
    expect(turn1.collectedFields).toContain("vehicleMake");

    const turn2 = applyConversationTurn({
      prior: turn1.intake,
      utterance: "Missouri plate KC7418",
    });
    expect(turn2.intake.locationText).toMatch(/1520 Main/i);
    expect(turn2.intake.vehicleMake?.toLowerCase()).toBe("honda");
    expect(turn2.intake.vehiclePlate).toBe("KC7418");
    expect(turn2.newlyCollected).toContain("vehiclePlate");
  });

  it("overwrites vehicle make on correction cue", () => {
    expect(utteranceHasCorrectionCue("It's a Toyota — wait, Honda Accord")).toBe(true);
    const prior = extractIntakeFields("It's a Toyota Camry", {});
    expect(prior.vehicleMake?.toLowerCase()).toBe("toyota");

    const corrected = applyConversationTurn({
      prior,
      utterance: "It's a Toyota — wait, Honda Accord.",
    });
    expect(corrected.hadCorrectionCue).toBe(true);
    expect(corrected.intake.vehicleMake?.toLowerCase()).toBe("honda");
    expect(corrected.intake.vehicleModel?.toLowerCase()).toMatch(/accord/);
    expect(corrected.correctedFields).toContain("vehicleMake");
    expect(spokenCorrectionAck(corrected.correctedFields, corrected.intake)).toMatch(/Honda/i);
  });

  it("lets utterance correction win over stale Lex slots", () => {
    const snap = applyConversationTurn({
      prior: { vehicleMake: "Toyota" },
      utterance: "wait, Honda",
      slotMap: { VehicleMake: "Toyota" },
    });
    expect(snap.intake.vehicleMake?.toLowerCase()).toBe("honda");
  });
});
