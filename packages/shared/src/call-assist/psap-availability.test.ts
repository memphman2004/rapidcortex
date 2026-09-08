import { describe, expect, it } from "vitest";
import { buildPsapAvailabilityNotice } from "./psap-availability.js";

describe("PSAP availability notice", () => {
  it("never presents campus or venue as a live 911 PSAP", () => {
    const campus = buildPsapAvailabilityNotice({ product: "campus" });
    expect(campus.status).toBe("not_on_rapid_cortex");
    expect(campus.showLiveOps).toBe(false);
    const venue = buildPsapAvailabilityNotice({ product: "venue", callAssistOnboarded: true, withinHours: true });
    expect(venue.showLiveOps).toBe(false);
    expect(venue.body.toLowerCase()).toMatch(/not a 911/);
  });

  it("marks PSAP Call Assist after hours", () => {
    const n = buildPsapAvailabilityNotice({
      product: "psap",
      callAssistOnboarded: true,
      withinHours: false,
      agencyName: "KCPD",
    });
    expect(n.status).toBe("after_hours");
    expect(n.showLiveOps).toBe(false);
  });

  it("allows live ops only for an onboarded PSAP in hours", () => {
    const n = buildPsapAvailabilityNotice({
      product: "psap",
      callAssistOnboarded: true,
      withinHours: true,
      agencyName: "KCPD",
    });
    expect(n.status).toBe("available");
    expect(n.showLiveOps).toBe(true);
  });
});
