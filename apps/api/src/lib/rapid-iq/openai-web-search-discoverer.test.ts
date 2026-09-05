import { describe, expect, it } from "vitest";
import {
  buildWatchSearchQueries,
  discoverUrlsForWatch,
  extractAndRankDiscoveryUrls,
} from "./openai-web-search-discoverer.js";

describe("extractAndRankDiscoveryUrls", () => {
  it("drops noise hosts and ranks procurement platforms above generic sites", () => {
    const ranked = extractAndRankDiscoveryUrls(
      [
        "see https://www.google.com/search?q=rfp",
        "https://news.example.com/story",
        "https://agency.gov/bids",
        "https://city.planetbids.com/portal/123",
      ].join(" "),
      [],
      5,
    );
    expect(ranked[0]).toContain("planetbids.com");
    expect(ranked[1]).toContain("agency.gov");
    expect(ranked.some((u) => u.includes("google.com"))).toBe(false);
  });

  it("skips URLs already on the watch", () => {
    const ranked = extractAndRankDiscoveryUrls(
      "https://sam.gov/opp/1 https://city.bonfirehub.com/portal",
      ["https://sam.gov/opp/1"],
      5,
    );
    expect(ranked).toEqual(["https://city.bonfirehub.com/portal"]);
  });
});

describe("buildWatchSearchQueries", () => {
  it("returns a precision portal query and a recall solicitation query", () => {
    const queries = buildWatchSearchQueries({
      agency: "Fulton County 911",
      keywords: ["911", "CAD", "NG911"],
    });
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain("procurement");
    expect(queries[1]).toContain("request for proposal");
  });
});

describe("discoverUrlsForWatch", () => {
  it("skips watches without webSearchEnabled", async () => {
    const result = await discoverUrlsForWatch({
      id: "transit-cta",
      name: "CTA",
      agency: "Chicago Transit Authority",
      market: "TRANSIT",
      enabled: true,
      keywords: ["transit"],
      sourceDomains: ["transitchicago.com"],
      sourceUrls: ["https://www.transitchicago.com/procurement/"],
      minimumFitScore: 7,
      webSearchEnabled: false,
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });
    expect(result.skipped).toBe(true);
    expect(result.queriesRun).toBe(0);
    expect(result.discoveredUrls).toEqual([]);
  });
});
