import { describe, expect, it } from "vitest";
import { buildUsaSpendingSearchBody } from "../../../handlers/rapid-iq/pipeline/ingest-usa-spending.js";

describe("buildUsaSpendingSearchBody", () => {
  it("uses Last Modified Date — Action Date is rejected for grant awards", () => {
    const body = buildUsaSpendingSearchBody(new Date("2026-08-16T12:00:00.000Z"));
    expect(body.sort).toBe("Last Modified Date");
    expect(body.fields).toContain("Last Modified Date");
    expect(body.fields).not.toContain("Action Date");
    expect(body.filters.time_period[0]?.start_date).toBe("2026-01-01");
    expect(body.filters.time_period[0]?.end_date).toBe("2026-08-16");
  });
});
