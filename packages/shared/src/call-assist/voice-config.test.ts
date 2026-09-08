import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALL_ASSIST_DEMO_SCENARIO_TEMPLATES,
  CALL_ASSIST_LEX_DEMO_TEMPLATES,
  GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
  GENERIC_CALL_ASSIST_OPENING_TEMPLATE,
  callAssistLexBotName,
  interpolateCallAssistVoice,
  shouldApplyCallAssistReferenceSeed,
} from "./index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("Call Assist multi-agency voice config", () => {
  it("interpolates Fulton County 911 without leftover placeholders", () => {
    const spoken = interpolateCallAssistVoice(GENERIC_CALL_ASSIST_OPENING_TEMPLATE, {
      agencyShortName: "Fulton County 911",
      agencyName: "Fulton County 911",
      emergencyLine: "911",
      agencyWebsite: "fulton911.gov",
    });
    expect(spoken).toContain("Fulton County 911");
    expect(spoken).not.toMatch(/\{\{|\}\}|Kansas City|KCPD/i);
  });

  it("does not apply the KCPD seed overlay to a second agency", () => {
    expect(shouldApplyCallAssistReferenceSeed("fulton-county", "kcpd", "kcpd")).toBe(false);
    expect(shouldApplyCallAssistReferenceSeed("kcpd", "kcpd", "kcpd")).toBe(true);
    expect(shouldApplyCallAssistReferenceSeed("kcpd", "", "kcpd")).toBe(false);
  });

  it("names Lex bots per agency slug", () => {
    expect(callAssistLexBotName("fulton-county", "dev")).toBe("RCCallAssistBot-fultoncounty-dev");
  });

  it("ships generic demo templates without Kansas City streets or kcpd.org", () => {
    const blob = JSON.stringify(CALL_ASSIST_DEMO_SCENARIO_TEMPLATES) + JSON.stringify(CALL_ASSIST_LEX_DEMO_TEMPLATES);
    expect(blob).not.toMatch(/Troost|Wornall|Paseo|Kansas City|kcpd\.org/i);
    expect(CALL_ASSIST_DEMO_SCENARIO_TEMPLATES).toHaveLength(10);
    expect(CALL_ASSIST_LEX_DEMO_TEMPLATES).toHaveLength(10);
  });

  it("uses placeholders in generic disclosure, not a city name", () => {
    expect(GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE).toContain("{{agencyShortName}}");
    expect(GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE).not.toMatch(/Kansas City|KCPD/i);
  });

  it("Lex spec template has no Kansas City Police spoken copy", () => {
    const spec = readFileSync(join(repoRoot, "connect/lex-bot-complete-spec.md"), "utf8");
    expect(spec).not.toMatch(/Kansas City Police/i);
    expect(spec).not.toMatch(/kcpd\.org/i);
    expect(spec).not.toMatch(/Policía de Kansas City/i);
  });
});
