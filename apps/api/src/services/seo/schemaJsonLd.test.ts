import { describe, expect, it } from "vitest";
import { generateJsonLd } from "./schemaJsonLd.js";

describe("generateJsonLd", () => {
  it("outputs Organization JSON-LD with @context", () => {
    const doc = generateJsonLd("Organization", { name: "Rapid Cortex", url: "https://example.com" });
    expect(doc["@context"]).toBe("https://schema.org");
    expect(doc["@type"]).toBe("Organization");
    expect(doc.name).toBe("Rapid Cortex");
  });

  it("outputs FAQPage JSON-LD", () => {
    const doc = generateJsonLd("FAQPage", {
      mainEntity: [],
    });
    expect(doc["@type"]).toBe("FAQPage");
  });
});
