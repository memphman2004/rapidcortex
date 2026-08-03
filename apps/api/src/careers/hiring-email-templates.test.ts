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
    expect(email!.text).toContain("Excited to meet you.");
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
