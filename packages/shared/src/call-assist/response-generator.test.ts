import { describe, expect, it } from "vitest";
import { ResponseGenerator } from "./response-generator.js";

describe("ResponseGenerator", () => {
  it("speaks Fulton County 911 from voice config, never Kansas City", () => {
    const spoken = new ResponseGenerator({
      agencyDisplayName: "Fulton County 911",
      agencyShortName: "Fulton County",
      officerLabel: "officer",
      emergencyLine: "911",
    });
    expect(spoken.incidentCreated("FC-1001")).toContain("I've created a report for Fulton County 911");
    expect(spoken.incidentCreated("FC-1001")).toContain("An officer will follow up");
    expect(spoken.humanTransfer()).toContain("a Fulton County officer");
    expect(spoken.opening()).toContain("Fulton County 911");
    expect(spoken.emergencyTransfer()).toContain("dial 911");
    const blob = [
      spoken.incidentCreated("FC-1001"),
      spoken.humanTransfer(),
      spoken.opening(),
      spoken.emergencyTransfer(),
      spoken.fallbackTransfer(),
    ].join(" ");
    expect(blob).not.toMatch(/Kansas City|KCPD|kcpd\.org|Troost/i);
  });

  it("uses a/an from officerLabel (deputy vs officer)", () => {
    const deputy = new ResponseGenerator({
      agencyDisplayName: "Fulton County Sheriff",
      agencyShortName: "Fulton County",
      officerLabel: "deputy",
      emergencyLine: "911",
    });
    expect(deputy.humanTransfer()).toContain("a Fulton County deputy");
    expect(deputy.incidentCreated("1")).toMatch(/^I've created a report for Fulton County Sheriff/);
    expect(deputy.incidentCreated("1")).toContain("A deputy will follow up");
  });

  it("interpolates disclosure placeholders from config", () => {
    const spoken = new ResponseGenerator({
      agencyDisplayName: "Fulton County 911",
      agencyShortName: "Fulton County",
      officerLabel: "officer",
      emergencyLine: "911",
      disclosureText: "You are speaking with an AI assistant for {{agencyShortName}}.",
    });
    expect(spoken.opening()).toBe("You are speaking with an AI assistant for Fulton County.");
    expect(spoken.opening()).not.toMatch(/\{\{/);
  });
});
