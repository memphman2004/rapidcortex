import { describe, expect, it } from "vitest";
import { buildContactSearchTargets } from "../agency-contact-finder.js";
import { ALL_JURISDICTIONS } from "../jurisdiction-registry.js";

describe("agency contact finder targets", () => {
  it("prefers registry contactUrls for Muscogee and peers", () => {
    const muscogee = ALL_JURISDICTIONS.find((j) => j.jurisdictionId === "county#GA#muscogee");
    expect(muscogee?.contactUrls?.length).toBeGreaterThan(0);
    const targets = buildContactSearchTargets(
      "Muscogee County 911",
      "Columbus",
      "GA",
      "911",
      muscogee?.contactUrls ?? [],
    );
    expect(targets[0]?.url).toContain("muscogee911.com");
  });

  it("includes Jefferson / DeSoto / Upshur known directories", () => {
    for (const id of ["county#AL#jefferson", "county#FL#desoto", "county#WV#upshur"]) {
      const j = ALL_JURISDICTIONS.find((x) => x.jurisdictionId === id);
      expect(j?.contactUrls?.length, id).toBeGreaterThan(0);
    }
  });
});

describe("summary quality prompt", () => {
  it("classifier module exports classifySignal", async () => {
    const mod = await import("../claude-classifier.js");
    expect(typeof mod.classifySignal).toBe("function");
    expect(typeof mod.signalChat).toBe("function");
  });
});
