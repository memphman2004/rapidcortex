import { describe, expect, it } from "vitest";
import { pipelineSourceIdForIntelSource } from "../pipeline-source.js";

describe("pipelineSourceIdForIntelSource", () => {
  it("maps known civic / federal hosts onto Rapid iQ source ids", () => {
    expect(
      pipelineSourceIdForIntelSource({
        url: "https://example.portal.civicclerk.com/",
        name: "City agendas",
        sourceType: "BOARD_AGENDA",
      }),
    ).toBe("civiclerk");
    expect(
      pipelineSourceIdForIntelSource({
        url: "https://www.fcc.gov/public-safety",
        name: "FCC reports",
        sourceType: "AGENCY",
      }),
    ).toBe("fcc-reports");
    expect(
      pipelineSourceIdForIntelSource({
        url: "https://www.911.gov/ng911",
        name: "911.gov",
        sourceType: "GRANT",
      }),
    ).toBe("911-gov");
  });

  it("defaults other intel sources to nexiq-intel", () => {
    expect(
      pipelineSourceIdForIntelSource({
        url: "https://procurement.maconbibb.us/bids",
        name: "Macon-Bibb Procurement",
        organization: "Macon-Bibb County",
        sourceType: "PROCUREMENT",
      }),
    ).toBe("nexiq-intel");
  });
});
