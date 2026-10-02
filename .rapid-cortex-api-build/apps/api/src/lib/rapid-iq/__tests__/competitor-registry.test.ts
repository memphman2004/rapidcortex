import { describe, expect, it } from "vitest";
import {
  COMPETITOR_REGISTRY,
  extractMentionedCompetitors,
  findCompetitor,
  HIGH_URGENCY_COMPETITORS,
  resolveIncumbentBrand,
} from "../competitor-registry.js";

describe("competitor-registry", () => {
  it("includes 20+ competitors across verticals", () => {
    expect(COMPETITOR_REGISTRY.length).toBeGreaterThanOrEqual(20);
    expect(COMPETITOR_REGISTRY.some((c) => c.verticals.includes("911"))).toBe(true);
    expect(COMPETITOR_REGISTRY.some((c) => c.verticals.includes("campus"))).toBe(true);
    expect(COMPETITOR_REGISTRY.some((c) => c.verticals.includes("venue"))).toBe(true);
  });

  it("lists Carbyne and Prepared as Axon aliases", () => {
    const axon = COMPETITOR_REGISTRY.find((c) => c.id === "axon");
    expect(axon?.aliases).toEqual(expect.arrayContaining(["Carbyne", "Prepared"]));
  });

  it("lists Motorola aliases including Zetron, Spillman, LiveSafe, Exacom", () => {
    const motorola = COMPETITOR_REGISTRY.find((c) => c.id === "motorola");
    expect(motorola?.aliases).toEqual(
      expect.arrayContaining(["Zetron", "Spillman", "LiveSafe", "Exacom"]),
    );
  });

  it("lists RapidSOS aliases including Rave Mobile Safety and Rave Guardian", () => {
    const rapidsos = COMPETITOR_REGISTRY.find((c) => c.id === "rapidsos");
    expect(rapidsos?.aliases).toEqual(
      expect.arrayContaining(["Rave Mobile Safety", "Rave Guardian"]),
    );
  });

  it("findCompetitor(Carbyne) returns the Axon entry", () => {
    expect(findCompetitor("Carbyne")?.id).toBe("axon");
  });

  it("resolveIncumbentBrand maps Carbyne/Prepared to Axon", () => {
    expect(resolveIncumbentBrand("Carbyne")).toBe("Axon");
    expect(resolveIncumbentBrand("Prepared")).toBe("Axon");
  });

  it("extractMentionedCompetitors finds Motorola from PremierOne CAD", () => {
    const hits = extractMentionedCompetitors("agency uses PremierOne CAD");
    expect(hits.some((c) => c.id === "motorola")).toBe(true);
  });

  it("exposes high-urgency competitors for Teams displacement alerts", () => {
    expect(HIGH_URGENCY_COMPETITORS.some((n) => n.toLowerCase().includes("axon"))).toBe(true);
    expect(HIGH_URGENCY_COMPETITORS.some((n) => n.toLowerCase().includes("24/7"))).toBe(true);
  });
});
