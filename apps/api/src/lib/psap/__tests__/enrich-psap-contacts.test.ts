import { describe, expect, it } from "vitest";
import {
  buildDomainFromName,
  buildEnrichmentChangeLog,
  guessPsapDomains,
  type EnrichPsapContactsResult,
} from "../enrich-psap-contacts.js";
import type { PsapProspect } from "rapid-cortex-shared";

describe("buildDomainFromName", () => {
  it("builds franklin county ohio gov domain", () => {
    expect(buildDomainFromName("Franklin County", "OH")).toBe("franklincountyohio.gov");
  });

  it("strips 911 / PSAP noise from names", () => {
    expect(buildDomainFromName("Franklin County 911", "OH")).toBe("franklincountyohio.gov");
  });
});

describe("guessPsapDomains", () => {
  it("prefers short county.gov / county{st}.gov over invented full-state names", () => {
    const domains = guessPsapDomains("LIVINGSTON COUNTY 911 CENTER", "NY");
    expect(domains[0]).toBe("livingstoncounty.gov");
    expect(domains).toContain("livingstoncountyny.gov");
    expect(domains).toContain("livingstoncounty.us");
    expect(domains).toContain("livingston911.com");
    expect(domains.indexOf("livingstoncounty.gov")).toBeLessThan(
      domains.indexOf("livingstoncountynewyork.gov"),
    );
  });
});

function stubProspect(over: Partial<PsapProspect> = {}): PsapProspect {
  return {
    psapId: "p1",
    psapName: "ALABASTER POLICE DEPARTMENT",
    county: "Shelby",
    state: "AL",
    city: "Alabaster",
    phone: "",
    fips: "01117",
    latitude: 0,
    longitude: 0,
    outreachStatus: "not_contacted",
    activities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    importedFrom: "test",
    ...over,
  };
}

describe("buildEnrichmentChangeLog", () => {
  it("reports timestamp-only when APIs fail and no contacts are saved", () => {
    const before = stubProspect();
    const after = stubProspect({
      lastEnrichedAt: "2026-08-20T18:10:59.000Z",
      updatedAt: "2026-08-20T18:10:59.000Z",
      contacts: [],
      contactCount: 0,
    });
    const enriched: EnrichPsapContactsResult = {
      contacts: [],
      hunterCount: 0,
      apolloCount: 0,
      domains: ["alabasterpolicedepartmentalabama.gov"],
      traces: [
        {
          provider: "hunter",
          domain: "alabasterpolicedepartmentalabama.gov",
          httpStatus: 429,
          rawHits: 0,
          kept: 0,
          error: "rate_limited",
        },
        {
          provider: "apollo",
          domain: "alabasterpolicedepartmentalabama.gov",
          httpStatus: 401,
          rawHits: 0,
          kept: 0,
          error: "invalid_api_key",
        },
      ],
    };
    const log = buildEnrichmentChangeLog(before, after, enriched);
    expect(log.changed).toBe(false);
    expect(log.reason).toBe("rate_limited+invalid_api_key");
    expect(log.fieldsChanged).toEqual(["lastEnrichedAt"]);
    expect(log.savedContacts).toEqual([]);
  });
});

describe("buildDomainFromName", () => {
  it("builds franklin county ohio gov domain", () => {
    expect(buildDomainFromName("Franklin County", "OH")).toBe("franklincountyohio.gov");
  });

  it("strips 911 / PSAP noise from names", () => {
    expect(buildDomainFromName("Franklin County 911", "OH")).toBe("franklincountyohio.gov");
  });
});

describe("guessPsapDomains", () => {
  it("prefers short county.gov / county{st}.gov over invented full-state names", () => {
    const domains = guessPsapDomains("LIVINGSTON COUNTY 911 CENTER", "NY");
    expect(domains[0]).toBe("livingstoncounty.gov");
    expect(domains).toContain("livingstoncountyny.gov");
    expect(domains).toContain("livingstoncounty.us");
    expect(domains).toContain("livingston911.com");
    expect(domains.indexOf("livingstoncounty.gov")).toBeLessThan(
      domains.indexOf("livingstoncountynewyork.gov"),
    );
  });
});
