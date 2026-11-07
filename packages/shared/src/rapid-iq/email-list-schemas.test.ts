import { describe, expect, it } from "vitest";
import {
  EMAIL_LIST_VERTICALS,
  addEmailListEntryBodySchema,
  emailListVerticalsForCampaign,
  normalizeEmailListVertical,
} from "./email-list-schemas.js";

describe("email list schemas", () => {
  it("normalizes verticals", () => {
    expect(normalizeEmailListVertical("campus")).toBe("CAMPUS");
    expect(normalizeEmailListVertical("all")).toBe("PSAP");
    expect(EMAIL_LIST_VERTICALS).toContain("PSAP");
  });

  it("expands ALL campaign verticals", () => {
    expect(emailListVerticalsForCampaign("ALL")).toEqual([...EMAIL_LIST_VERTICALS]);
    expect(emailListVerticalsForCampaign("VENUE")).toEqual(["VENUE"]);
  });

  it("parses add body with default source", () => {
    const parsed = addEmailListEntryBodySchema.parse({
      email: "chief@example.gov",
      vertical: "PSAP",
    });
    expect(parsed.source).toBe("manual");
    expect(parsed.email).toBe("chief@example.gov");
  });
});
