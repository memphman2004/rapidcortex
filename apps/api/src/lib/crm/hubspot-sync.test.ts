import { describe, expect, it } from "vitest";
import { createHubSpotContactAndDeal } from "./hubspot-sync.js";

describe("HubSpot contact and deal", () => {
  it("reuses an existing contact and creates the deal", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/contacts")) {
        return new Response(JSON.stringify({ message: "Contact already exists" }), { status: 409 });
      }
      if (url.endsWith("/contacts/search")) {
        return new Response(JSON.stringify({ results: [{ id: "contact-9" }] }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.associations[0].to.id).toBe("contact-9");
      expect(body.properties.dealname).toContain("NexCort iQ");
      return new Response(JSON.stringify({ id: "deal-4" }), { status: 200 });
    };

    const result = await createHubSpotContactAndDeal(
      "pat-test-token-not-real",
      {
        leadId: "lead-1",
        email: "ada@city.gov",
        agencyName: "Example PSAP",
        name: "Ada Lovelace",
      },
      fetchImpl,
    );
    expect(result).toEqual({ contactId: "contact-9", dealId: "deal-4" });
    expect(calls).toHaveLength(3);
  });
});