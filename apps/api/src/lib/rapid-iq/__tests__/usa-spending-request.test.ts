import { describe, expect, it } from "vitest";
import { buildUsaSpendingContractSearchBody, buildUsaSpendingSearchBody } from "../../../handlers/rapid-iq/pipeline/ingest-usa-spending.js";

describe("buildUsaSpendingSearchBody", () => {
  it("uses Last Modified Date — Action Date is rejected for grant awards", () => {
    const body = buildUsaSpendingSearchBody(new Date("2026-08-16T12:00:00.000Z"));
    expect(body.sort).toBe("Last Modified Date");
    expect(body.fields).toContain("Last Modified Date");
    expect(body.fields).not.toContain("Action Date");
    expect(body.filters.time_period[0]?.start_date).toBe("2026-01-01");
    expect(body.filters.time_period[0]?.end_date).toBe("2026-08-16");
    expect(body.filters.program_numbers).toContain("21.027");
    expect(body.filters.program_numbers).toContain("20.615");
  });

  it("searches federal contracts by public-safety NAICS as a SAM.gov stand-in", () => {
    const body = buildUsaSpendingContractSearchBody(new Date("2026-08-16T12:00:00.000Z"));
    expect(body.filters.award_type_codes).toEqual(["A", "B", "C", "D"]);
    expect(body.filters.naics_codes).toContain("541512");
    expect(body.filters.naics_codes).toContain("922190");
  });
});
