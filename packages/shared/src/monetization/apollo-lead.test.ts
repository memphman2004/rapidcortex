import { describe, expect, it } from "vitest";
import { apolloLeadDraftFromEvent } from "./apollo-lead.js";

describe("apolloLeadDraftFromEvent", () => {
  it("reads a nested Apollo person", () => {
    const draft = apolloLeadDraftFromEvent({
      person: {
        id: "apollo_1",
        first_name: "Ada",
        last_name: "Lovelace",
        email: "Ada@Example.com",
        title: "Director",
        organization: { name: "Analytical Engines" },
        phone_numbers: [{ sanitized_number: "+15551234567" }],
        city: "Austin",
        state: "TX",
      },
    });
    expect(draft).toMatchObject({
      apolloContactId: "apollo_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+15551234567",
      agencyCompany: "Analytical Engines",
      title: "Director",
      city: "Austin",
      state: "TX",
    });
  });

  it("finds an email nested in a workflow event", () => {
    const draft = apolloLeadDraftFromEvent({
      event: JSON.stringify({
        contact: { first_name: "Grace", emails: [{ email: "grace@engines.com" }], organization_name: "Engines" },
      }),
    });
    expect(draft.email).toBe("grace@engines.com");
    expect(draft.name).toBe("Grace");
    expect(draft.agencyCompany).toBe("Engines");
  });

  it("rejects a contact with no email", () => {
    expect(() => apolloLeadDraftFromEvent({ first_name: "Ada", organization_name: "Engines" })).toThrow(
      /email/i,
    );
  });
});
