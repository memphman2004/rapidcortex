import { describe, expect, it } from "vitest";
import { rapidIqWatchIngestRequestSchema } from "./pipeline-schemas.js";

describe("rapidIqWatchIngestRequestSchema", () => {
  it("accepts a single watch payload", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      watch: "psap_rfp",
      external_key: "GA|Fulton|RFP-1",
      signal_type: "rfp",
      vertical: "911_psap",
      agency: { name: "Fulton County", state: "GA" },
      opportunity: {
        title: "NG911 services",
        procurement_url: "https://example.gov/rfp/1",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing procurement_url", () => {
    const parsed = rapidIqWatchIngestRequestSchema.safeParse({
      watch: "psap_rfp",
      external_key: "GA|Fulton|RFP-1",
      signal_type: "rfp",
      vertical: "911_psap",
      agency: { name: "Fulton County", state: "GA" },
      opportunity: { title: "NG911 services" },
    });
    expect(parsed.success).toBe(false);
  });
});
