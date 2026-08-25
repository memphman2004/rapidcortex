import { describe, expect, it } from "vitest";
import { ALL_JURISDICTIONS } from "../jurisdiction-registry.js";
import {
  allCountyProcurementEntries,
  crawlableCountyProcurementEntries,
  customProcurementPathHint,
  matchCountyProcurement,
  normalizeCountyKey,
  normalizeProcurementUrl,
} from "../county-procurement.js";
import { isCountyProcurementRelevant } from "../../../handlers/rapid-iq/pipeline/ingest-county-procurement.js";

describe("county procurement registry merge", () => {
  it("has hundreds of crawlable portals and skips state-portal + duplicate URLs", () => {
    const crawlable = crawlableCountyProcurementEntries();
    expect(crawlable.length).toBeGreaterThan(700);
    expect(crawlable.length).toBeLessThan(1000);
    expect(crawlable.every((c) => c.platform !== "state-portal")).toBe(true);
    const urls = crawlable.map((c) => normalizeProcurementUrl(c.url));
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("covers all 50 states after the remaining-state merge", () => {
    const states = new Set(allCountyProcurementEntries().map((c) => c.state));
    expect(states.size).toBe(50);
    expect(matchCountyProcurement("DE", "New Castle County")?.platform).toBe("opengov");
    expect(matchCountyProcurement("WA", "King County")?.url).toContain("kingcounty");
    expect(matchCountyProcurement("WV", "Kanawha County")?.platform).toBe("opengov");
  });

  it("maps Macon-Bibb and Bibb County GA to the same OpenGov portal", () => {
    expect(normalizeCountyKey("GA", "Macon-Bibb County")).toBe("ga#maconbibb");
    expect(normalizeCountyKey("GA", "Bibb County")).toBe("ga#maconbibb");
    const bibb = matchCountyProcurement("GA", "Macon-Bibb County");
    expect(bibb?.platform).toBe("opengov");
    expect(bibb?.url).toContain("maconbibb");
  });

  it("matches existing agenda seeds without adding duplicate hosts to ALL_JURISDICTIONS", () => {
    const fulton = ALL_JURISDICTIONS.find((j) => j.jurisdictionId === "county#GA#fulton");
    const portal = matchCountyProcurement("GA", "Fulton County");
    expect(fulton).toBeDefined();
    expect(portal?.platform).toBe("opengov");
    expect(normalizeProcurementUrl(portal!.url)).not.toBe(
      normalizeProcurementUrl(fulton!.agendaBaseUrl),
    );
  });

  it("collapses NYC borough rows to one crawl URL", () => {
    expect(normalizeCountyKey("NY", "Kings County (Brooklyn)")).toBe("ny#nyc");
    expect(normalizeCountyKey("NY", "New York City")).toBe("ny#nyc");
    const nycHits = crawlableCountyProcurementEntries().filter(
      (c) => normalizeCountyKey(c.state, c.county) === "ny#nyc",
    );
    expect(nycHits).toHaveLength(1);
  });

  it("uses same-host custom purchasing paths on existing seeds", () => {
    const madison = ALL_JURISDICTIONS.find((j) => j.jurisdictionId === "county#AL#madison");
    expect(madison).toBeDefined();
    const path = customProcurementPathHint(madison!);
    expect(path).toMatch(/purchasing/i);
  });

  it("does not treat universities as county procurement matches", () => {
    expect(matchCountyProcurement("GA", "University of Georgia")).toBeUndefined();
  });
});

describe("county procurement relevance", () => {
  it("accepts NG911 / ESInet bid text and rejects unrelated debris RFPs", () => {
    expect(
      isCountyProcurementRelevant(
        "RFP 27-006 Next Generation 9-1-1 ESInet and Public Safety Communications",
      ),
    ).toBe(true);
    expect(isCountyProcurementRelevant("Debris Removal Services invitation to bid")).toBe(false);
    expect(isCountyProcurementRelevant("Cascade County facilities maintenance cascade")).toBe(false);
  });
});
