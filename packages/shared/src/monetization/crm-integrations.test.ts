import { describe, expect, it } from "vitest";
import {
  crmAgentPrompt,
  hubSpotObjectsForLead,
  isLeadReply,
} from "./crm-integrations.js";

describe("CRM integrations", () => {
  it("treats an inbound email as a reply", () => {
    expect(
      isLeadReply({
        type: "email_logged",
        description: "She replied and asked for a pilot quote",
      }),
    ).toBe(true);
    expect(
      isLeadReply({
        type: "call_logged",
        description: "Left a voicemail",
        metadata: { direction: "inbound" },
      }),
    ).toBe(true);
    expect(isLeadReply({ type: "email_logged", description: "Sent the intro" })).toBe(false);
  });

  it("builds a HubSpot contact and deal from the lead", () => {
    const objects = hubSpotObjectsForLead({
      leadId: "lead-1",
      email: "ada@city.gov",
      name: "Ada Lovelace",
      agencyName: "Example PSAP",
      estimatedValue: 24000,
      phone: "555-0100",
      title: "Director",
      pipelineStage: "CONTACTED",
    });
    expect(objects.contact).toMatchObject({
      email: "ada@city.gov",
      firstname: "Ada",
      lastname: "Lovelace",
      company: "Example PSAP",
      jobtitle: "Director",
    });
    expect(objects.deal.dealname).toBe("Example PSAP — NexCort iQ");
    expect(objects.deal.amount).toBe("24000");
  });

  it("writes an agent prompt without a token", () => {
    const prompt = crmAgentPrompt("https://app.rapidcortex.us");
    expect(prompt).toContain("GET https://app.rapidcortex.us/api/rc-admin/leads/integrations");
    expect(prompt.toLowerCase()).not.toContain("pat-");
    expect(prompt).toContain("Do not ask for or print the private app token");
  });
});