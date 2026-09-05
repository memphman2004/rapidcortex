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
    expect(result.skipReason).toBe("watch_web_search_disabled");
    expect(result.queriesRun).toBe(0);
    expect(result.discoveredUrls).toEqual([]);
  });

  it("skips with OPENAI_WEB_SEARCH_ENABLED not true when the watch flag is on", async () => {
    const prevMock = process.env.RAPID_IQ_COLLECTORS_MOCK;
    const prevFlag = process.env.OPENAI_WEB_SEARCH_ENABLED;
    const prevArn = process.env.ANTHROPIC_API_KEY_SECRET_ARN;
    process.env.RAPID_IQ_COLLECTORS_MOCK = "false";
    process.env.ANTHROPIC_API_KEY_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:1:secret:x";
    delete process.env.OPENAI_WEB_SEARCH_ENABLED;
    try {
      const result = await discoverUrlsForWatch({
        id: "psap-fulton-county-ga",
        name: "Fulton County 911",
        agency: "Fulton County Emergency Communications",
        market: "PSAP",
        enabled: true,
        keywords: ["911"],
        sourceDomains: ["fultoncountyga.gov"],
        sourceUrls: ["https://www.fultoncountyga.gov/"],
        minimumFitScore: 7,
        webSearchEnabled: true,
        createdAt: "2026-09-04T00:00:00.000Z",
        updatedAt: "2026-09-04T00:00:00.000Z",
      });
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("OPENAI_WEB_SEARCH_ENABLED not true");
      expect(result.queriesRun).toBe(0);
    } finally {
      if (prevMock === undefined) delete process.env.RAPID_IQ_COLLECTORS_MOCK;
      else process.env.RAPID_IQ_COLLECTORS_MOCK = prevMock;
      if (prevFlag === undefined) delete process.env.OPENAI_WEB_SEARCH_ENABLED;
      else process.env.OPENAI_WEB_SEARCH_ENABLED = prevFlag;
      if (prevArn === undefined) delete process.env.ANTHROPIC_API_KEY_SECRET_ARN;
      else process.env.ANTHROPIC_API_KEY_SECRET_ARN = prevArn;
    }
  });
});
