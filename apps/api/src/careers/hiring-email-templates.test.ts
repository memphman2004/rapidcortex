import { describe, expect, it } from "vitest";
import { buildEmail, EMAIL_TRIGGERS } from "./hiring-email-templates.js";

describe("hiring email templates", () => {
  const base = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    position: "Executive Assistant / Startup Operations Coordinator",
    reviewerName: "Jeffrey Coleman",
  };

  it("builds rejection with careers URL", () => {
    const email = buildEmail("REJECTED", base);
    expect(email).not.toBeNull();
    expect(email!.subject).toContain("Update");
    expect(email!.html).toContain("www.rapidcortex.us/careers");
    expect(email!.text).toContain("www.rapidcortex.us/careers");
  });

  it("includes scheduling link CTA for phone screen", () => {
    const email = buildEmail("PHONE_SCREEN", {
      ...base,
      schedulingLink: "https://calendly.com/example/phone",
      customMessage: "Excited to meet you.",
    });
    expect(email).not.toBeNull();
    expect(email!.html).toContain("https://calendly.com/example/phone");
    expect(email!.html).toContain("Excited to meet you.");
    expect(email!.html).toContain("phone call — no video");
    expect(email!.html).toContain("We will call you at the number you provide during booking.");
    expect(email!.text).toContain("Excited to meet you.");
    expect(email!.text).toContain("no video required");
  });

  it("interview email mentions Teams and booking confirmation", () => {
    const email = buildEmail("INTERVIEW", {
      ...base,
      schedulingLink: "https://outlook.office.com/book/VideoInterview@rapidcortex.us/",
    });
    expect(email).not.toBeNull();
    expect(email!.html).toContain("Microsoft Teams video call");
    expect(email!.html).toContain("A Teams meeting link will be included in your booking confirmation email.");
    expect(email!.text).toContain("Microsoft Teams video call");
    expect(email!.text).toContain("booking confirmation email");
  });

  it("does not treat statusNote fallback — customMessage alone", () => {
    const email = buildEmail("INTERVIEW", {
      ...base,
      customMessage: undefined,
    });
    expect(email).not.toBeNull();
    expect(email!.html).not.toContain("undefined");
  });

  it("returns null for non-trigger statuses", () => {
    expect(buildEmail("REVIEWING", base)).toBeNull();
    expect(EMAIL_TRIGGERS.has("REVIEWING")).toBe(false);
  });
});
