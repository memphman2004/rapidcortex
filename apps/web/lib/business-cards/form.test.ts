import { describe, expect, it } from "vitest";
import { BIOGRAPHY_MAX_LENGTH, EMPTY_FORM, cardFormIssues, payloadFromForm } from "./form";

describe("business card form payload", () => {
  it("omits locked fields from an employee save", () => {
    const body = payloadFromForm(
      {
        ...EMPTY_FORM,
        version: 2,
        displayName: "Ada Lovelace",
        title: "Engineer",
        companyName: "Should not be sent",
        website: "https://evil.example",
        primaryEmail: "ada@nexcortiq.us",
        mobile: "+14155552671",
        mobilePublic: true,
        lockedFields: ["companyName", "website", "primaryEmail", "title"],
      },
      false,
    );
    expect(body.displayName).toBe("Ada Lovelace");
    expect(body.title).toBeUndefined();
    expect(body.companyName).toBeUndefined();
    expect(body.website).toBe("https://evil.example");
    expect(payloadFromForm({ ...EMPTY_FORM, version: 1, website: "www.NexCortIQ.com" }, false).website).toBe(
      "https://www.NexCortIQ.com",
    );
    expect(body.emailAddresses).toEqual([{ type: "primary", address: "ada@nexcortiq.us", public: true }]);
    expect(body.phoneNumbers).toEqual([{ type: "mobile", number: "+14155552671", public: true }]);
  });

  it("keeps social link order and the office country", () => {
    const body = payloadFromForm(
      {
        ...EMPTY_FORM,
        version: 1,
        displayName: "Ada Lovelace",
        country: "USA",
        city: "San Francisco",
        orderedLinks: [
          { id: "ig", type: "custom", label: "Instagram", url: "https://instagram.com/ada", public: true },
          { id: "li", type: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/ada", public: true },
        ],
      },
      false,
    );
    expect(body.socialLinks).toEqual([
      { type: "custom", label: "Instagram", url: "https://instagram.com/ada", public: true },
      { type: "linkedin", url: "https://www.linkedin.com/in/ada", public: true },
    ]);
    expect(body.officeAddress).toMatchObject({ country: "USA", city: "San Francisco", public: true });
  });

  it("accepts a multi-paragraph bio", () => {
    const biography = [
      "Founder, Lead Software Engineer & Architect of **NexCort iQ**, a public safety intelligence platform transforming how communities communicate, coordinate, and respond to emergencies.",
      "",
      "A 20-year U.S. Army veteran with a Doctor of Business Administration, I bring together military leadership, technology innovation, and strategic vision to develop solutions that support first responders, strengthen public safety operations, and help create safer communities.",
      "",
      "My mission is simple: **Build technology that makes a meaningful difference when every second matters.**",
      "",
      "*Intelligence at the speed of response.*",
    ].join("\n");
    expect(biography.length).toBeLessThanOrEqual(BIOGRAPHY_MAX_LENGTH);
    expect(cardFormIssues({ ...EMPTY_FORM, displayName: "Ada Lovelace", biography })).toEqual([]);
    expect(cardFormIssues({ ...EMPTY_FORM, displayName: "Ada Lovelace", biography: "A".repeat(BIOGRAPHY_MAX_LENGTH + 1) })).toContain(
      `Bio must be ${BIOGRAPHY_MAX_LENGTH} characters or fewer.`,
    );
  });
});
