import { describe, expect, it } from "vitest";
import {
  normalizeSalesAutomationVertical,
  RAPID_IQ_SALES_BULK_MAX_RECIPIENTS,
  rapidIqOutlookCallbackBodySchema,
  rapidIqOutlookStatusSchema,
  createRapidIqSalesBulkCampaignBodySchema,
  updateRapidIqSalesDraftBodySchema,
  updateRapidIqSalesSequenceBodySchema,
} from "./sales-automation-schemas.js";

describe("normalizeSalesAutomationVertical", () => {
  it("maps CRM and intel aliases onto NexiQ sales verticals", () => {
    expect(normalizeSalesAutomationVertical("rc911")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("911")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("psap")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("campus")).toBe("CAMPUS");
    expect(normalizeSalesAutomationVertical("venue")).toBe("VENUE");
    expect(normalizeSalesAutomationVertical("hospital")).toBe("HOSPITAL");
    expect(normalizeSalesAutomationVertical("transit")).toBe("TRANSIT");
    expect(normalizeSalesAutomationVertical("airport")).toBe("TRANSIT");
    expect(normalizeSalesAutomationVertical("all")).toBe("ALL");
  });

  it("defaults unknown values to PSAP", () => {
    expect(normalizeSalesAutomationVertical("unknown")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical(undefined)).toBe("PSAP");
  });
});

describe("outlook campaign-send schemas", () => {
  it("accepts a disconnected mailbox status without tokens", () => {
    const parsed = rapidIqOutlookStatusSchema.parse({
      configured: true,
      mock: true,
      connected: false,
    });
    expect(parsed.mailbox).toBeUndefined();
  });

  it("requires code and state on the OAuth callback body", () => {
    expect(rapidIqOutlookCallbackBodySchema.safeParse({}).success).toBe(false);
    expect(
      rapidIqOutlookCallbackBodySchema.parse({ code: "abc", state: "signed.state" }),
    ).toEqual({ code: "abc", state: "signed.state" });
  });

  it("accepts a 100+ recipient bulk campaign body", () => {
    const recipients = Array.from({ length: 120 }, (_, i) => ({
      email: `dir${i}@example.gov`,
      agencyName: `Agency ${i}`,
    }));
    const parsed = createRapidIqSalesBulkCampaignBodySchema.parse({
      vertical: "PSAP",
      campaignName: "911 Core outbound",
      recipients,
    });
    expect(parsed.recipients).toHaveLength(120);
    expect(RAPID_IQ_SALES_BULK_MAX_RECIPIENTS).toBe(500);
    const scheduled = createRapidIqSalesBulkCampaignBodySchema.parse({
      vertical: "PSAP",
      sendAt: "2026-09-20T14:30:00.000Z",
      recipients: [{ email: "a@example.gov", agencyName: "Agency" }],
    });
    expect(scheduled.sendAt).toBe("2026-09-20T14:30:00.000Z");
  });

  it("accepts a sequence email edit body", () => {
    const parsed = updateRapidIqSalesSequenceBodySchema.parse({
      recipientName: "Alex Rivera",
      steps: [{ stepNumber: 1, email: { subject: "New subject", bodyText: "New body" } }],
    });
    expect(parsed.steps?.[0]?.email.subject).toBe("New subject");
    expect(updateRapidIqSalesSequenceBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts a content draft edit body", () => {
    const parsed = updateRapidIqSalesDraftBodySchema.parse({
      subject: "Inside the Cortex",
      bodyText: "Week notes",
    });
    expect(parsed.bodyText).toBe("Week notes");
  });
});
