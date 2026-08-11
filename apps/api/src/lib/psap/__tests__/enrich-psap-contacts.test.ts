import { describe, expect, it } from "vitest";
import { buildDomainFromName } from "../enrich-psap-contacts.js";

describe("buildDomainFromName", () => {
  it("builds franklin county ohio gov domain", () => {
    expect(buildDomainFromName("Franklin County", "OH")).toBe("franklincountyohio.gov");
  });

  it("strips 911 / PSAP noise from names", () => {
    expect(buildDomainFromName("Franklin County 911", "OH")).toBe("franklincountyohio.gov");
  });
});
