import { describe, expect, it } from "vitest";
import { CALL_TRIAGE_CLASSIFICATIONS } from "./classifications.js";
import { classifyCallTriage } from "./triage.js";
import { evaluateSafety } from "./safety.js";
import { cloneAgencyTaxonomy, validateTaxonomyEmergencyLocks } from "./taxonomy.js";
import { PRESET_911, PRESET_CAMPUS, PRESET_VENUE, resolveAgencyTaxonomy } from "./taxonomy-presets.js";

describe("Call Assist taxonomy presets", () => {
  it("preset_911 contains exactly the 13 existing types (regression check)", () => {
    expect(PRESET_911.callTypes).toHaveLength(13);
    expect(PRESET_911.callTypes.map((t) => t.id)).toEqual([...CALL_TRIAGE_CLASSIFICATIONS]);
  });

  it("preset_campus contains no CAD nature codes (all null)", () => {
    expect(PRESET_CAMPUS.callTypes.every((t) => t.cadNatureCode === null)).toBe(true);
  });

  it("preset_venue contains no CAD nature codes (all null)", () => {
    expect(PRESET_VENUE.callTypes.every((t) => t.cadNatureCode === null)).toBe(true);
  });

  it("unknown fallback type always present and enabled", () => {
    for (const preset of [PRESET_911, PRESET_CAMPUS, PRESET_VENUE]) {
      const unknown = preset.callTypes.find((t) => t.id === "UNKNOWN" || t.id === "unknown");
      expect(unknown?.enabled).toBe(true);
      const stripped = cloneAgencyTaxonomy(preset);
      stripped.callTypes = stripped.callTypes.filter((t) => t.id !== "UNKNOWN" && t.id !== "unknown");
      const resolved = resolveAgencyTaxonomy({ taxonomy: stripped, vertical: preset.vertical });
      expect(resolved.callTypes.some((t) => t.id === "UNKNOWN" || t.id === "unknown")).toBe(true);
    }
  });
});

describe("Call Assist taxonomy triage", () => {
  it("resolves taxonomy from agency config, not a hardcoded 911-only array", () => {
    const campus = classifyCallTriage("Can you do a wellness check on my roommate in Myers Hall?", {
      taxonomy: PRESET_CAMPUS,
    });
    expect(campus.primaryClassification).toBe("wellness_check");
    expect(campus.primaryClassification).not.toBe("ANIMAL_CONTROL");
    expect(PRESET_CAMPUS.callTypes.map((t) => t.id)).not.toContain("ANIMAL_CONTROL");

    const municipalWellness = classifyCallTriage(
      "Can you do a wellness check on my roommate in Myers Hall?",
      { taxonomy: PRESET_911 },
    );
    expect(municipalWellness.primaryClassification).not.toBe("wellness_check");
    expect(PRESET_911.callTypes.map((t) => t.id)).not.toContain("wellness_check");
  });

  it("isEmergency: true type always routes to Safety engine regardless of config", () => {
    const custom = cloneAgencyTaxonomy(PRESET_CAMPUS);
    const row = custom.callTypes.find((t) => t.id === "wellness_check");
    if (row) {
      row.isEmergency = true;
      row.classifierKeywords = ["code-red-xyz"];
      row.label = "Custom emergency";
    }
    const result = classifyCallTriage("This is a code-red-xyz in the dorm", { taxonomy: custom });
    expect(result.emergencyDetected).toBe(true);
    expect(result.continueIntake).toBe(false);
    expect(result.escalationPath).toBe("emergency");
    expect(evaluateSafety("This is a code-red-xyz in the dorm").action).toBe("CONTINUE");
  });

  it("disabled call type is never matched by classifier", () => {
    const taxonomy = cloneAgencyTaxonomy(PRESET_911);
    const animal = taxonomy.callTypes.find((t) => t.id === "ANIMAL_CONTROL");
    if (animal) animal.enabled = false;
    const result = classifyCallTriage("stray dog loose near the park", { taxonomy });
    expect(result.primaryClassification).not.toBe("ANIMAL_CONTROL");
  });

  it("Safety engine still wins over taxonomy on emergency utterances", () => {
    const t = classifyCallTriage("loud music but this is an emergency", { taxonomy: PRESET_CAMPUS });
    expect(t.emergencyDetected).toBe(true);
    expect(t.continueIntake).toBe(false);
    expect(t.reasons).toContain("safety_engine_override");
  });

  it("locks emergency types against disable in the taxonomy editor", () => {
    const next = cloneAgencyTaxonomy(PRESET_911);
    const em = next.callTypes.find((t) => t.id === "EMERGENCY");
    if (em) em.enabled = false;
    expect(validateTaxonomyEmergencyLocks(PRESET_911, next)).toMatch(/cannot be disabled/i);
  });
});
