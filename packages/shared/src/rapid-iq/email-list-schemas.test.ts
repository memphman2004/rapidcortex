import { describe, expect, it } from "vitest";
import {
  EMAIL_LIST_UI_VERTICALS,
  EMAIL_LIST_VERTICALS,
  addEmailListEntryBodySchema,
  emailListPartitionsForVertical,
  emailListVerticalsForCampaign,
  moveEmailListEntryBodySchema,
  normalizeEmailListVertical,
} from "./email-list-schemas.js";

describe("email list schemas", () => {
  it("normalizes verticals", () => {
    expect(normalizeEmailListVertical("campus")).toBe("CAMPUS");
    expect(normalizeEmailListVertical("all")).toBe("PSAP");
    expect(normalizeEmailListVertical("law_enforcement")).toBe("PSAP");
    expect(normalizeEmailListVertical("fire_ems")).toBe("PSAP");
    expect(EMAIL_LIST_VERTICALS).toContain("PSAP");
    expect(EMAIL_LIST_VERTICALS).toContain("LAW_ENFORCEMENT");
    expect(EMAIL_LIST_VERTICALS).toContain("FIRE_EMS");
  });

  it("UI verticals omit separate law / fire tabs", () => {
    expect([...EMAIL_LIST_UI_VERTICALS]).toEqual([
      "PSAP",
      "CAMPUS",
      "VENUE",
      "HOSPITAL",
      "TRANSIT",
    ]);
    expect(EMAIL_LIST_UI_VERTICALS).not.toContain("LAW_ENFORCEMENT");
    expect(EMAIL_LIST_UI_VERTICALS).not.toContain("FIRE_EMS");
    expect(emailListPartitionsForVertical("PSAP")).toEqual([
      "PSAP",
      "LAW_ENFORCEMENT",
      "FIRE_EMS",
    ]);
  });

  it("expands ALL and PSAP campaign verticals", () => {
    expect(emailListVerticalsForCampaign("ALL")).toEqual([...EMAIL_LIST_VERTICALS]);
    expect(emailListVerticalsForCampaign("VENUE")).toEqual(["VENUE"]);
    expect(emailListVerticalsForCampaign("PSAP")).toEqual([
      "PSAP",
      "LAW_ENFORCEMENT",
      "FIRE_EMS",
    ]);
    expect(emailListVerticalsForCampaign("LAW_ENFORCEMENT")).toEqual([
      "PSAP",
      "LAW_ENFORCEMENT",
      "FIRE_EMS",
    ]);
  });

  it("parses add body with default source", () => {
    const parsed = addEmailListEntryBodySchema.parse({
      email: "chief@example.gov",
      vertical: "PSAP",
    });
    expect(parsed.source).toBe("manual");
    expect(parsed.email).toBe("chief@example.gov");
  });

  it("accepts agencyName with contact name on subscribe", () => {
    const parsed = addEmailListEntryBodySchema.parse({
      email: "chief@example.gov",
      vertical: "PSAP",
      name: "Jane Chief",
      agencyName: "Example County PSAP",
      state: "GA",
      source: "psap_prospect",
      psapId: "psap-1",
    });
    expect(parsed.agencyName).toBe("Example County PSAP");
    expect(parsed.state).toBe("GA");
    expect(parsed.name).toBe("Jane Chief");
  });

  it("parses move vertical body and rejects same vertical", () => {
    expect(
      moveEmailListEntryBodySchema.parse({
        email: "chief@example.gov",
        fromVertical: "PSAP",
        vertical: "CAMPUS",
      }),
    ).toEqual({
      email: "chief@example.gov",
      fromVertical: "PSAP",
      vertical: "CAMPUS",
    });
    expect(
      moveEmailListEntryBodySchema.safeParse({
        email: "chief@example.gov",
        fromVertical: "PSAP",
        vertical: "PSAP",
      }).success,
    ).toBe(false);
  });
});
