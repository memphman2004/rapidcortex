import { describe, expect, it } from "vitest";
import { parseCampaignCsv } from "./parse-campaign-csv.js";

describe("parseCampaignCsv", () => {
  it("parses a 100+ row campaign list with header aliases", () => {
    const header = "email,agency_name,recipient_name";
    const lines = Array.from({ length: 120 }, (_, i) => `dir${i}@example.gov,Agency ${i},Pat ${i}`);
    const parsed = parseCampaignCsv([header, ...lines].join("\n"));
    expect(parsed.rows).toHaveLength(120);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]).toEqual({
      email: "dir0@example.gov",
      agencyName: "Agency 0",
      recipientName: "Pat 0",
    });
  });

  it("skips invalid rows and requires an agency name", () => {
    const parsed = parseCampaignCsv("not-an-email,City\nbad@x, \nok@psap.gov,Metro PSAP,Alex");
    expect(parsed.rows).toEqual([{ email: "ok@psap.gov", agencyName: "Metro PSAP", recipientName: "Alex" }]);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
