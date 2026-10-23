import { describe, expect, it } from "vitest";
import { stampPsapContactFields, summarizePsapContacts } from "./contact-log.js";
import type { PsapProspect } from "./types.js";

function prospect(overrides: Partial<PsapProspect> = {}): PsapProspect {
  return {
    psapId: "p1",
    psapName: "Example PSAP",
    county: "Example",
    state: "GA",
    city: "Athens",
    phone: "555",
    fips: "",
    latitude: 0,
    longitude: 0,
    outreachStatus: "UNCONTACTED",
    activities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    importedFrom: "test",
    ...overrides,
  };
}

describe("summarizePsapContacts", () => {
  it("counts calls, email, mail, and demos and ignores notes", () => {
    const summary = summarizePsapContacts(
      prospect({
        activities: [
          {
            activityId: "1",
            type: "note",
            description: "left voicemail reminder",
            performedByUserId: "u1",
            performedByName: "Ada",
            performedAt: "2026-04-03T12:00:00.000Z",
          },
          {
            activityId: "2",
            type: "email",
            description: "sent intro",
            performedByUserId: "u2",
            performedByName: "Bea",
            performedAt: "2026-04-02T12:00:00.000Z",
          },
          {
            activityId: "3",
            type: "call",
            description: "spoke with director",
            performedByUserId: "u1",
            performedByName: "Ada",
            performedAt: "2026-04-01T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(summary.count).toBe(2);
    expect(summary.lastMethod).toBe("email");
    expect(summary.lastBy).toBe("Bea");
    expect(summary.lastAt).toBe("2026-04-02T12:00:00.000Z");
  });

  it("falls back to the stored last contact when the log is empty", () => {
    const summary = summarizePsapContacts(
      prospect({
        lastContactedAt: "2026-03-01T00:00:00.000Z",
        lastContactedBy: "Cam",
        lastContactMethod: "call",
      }),
    );
    expect(summary).toEqual({
      count: 1,
      lastAt: "2026-03-01T00:00:00.000Z",
      lastBy: "Cam",
      lastMethod: "call",
    });
  });

  it("stamps the denormalized fields from the log", () => {
    const stamped = stampPsapContactFields(
      prospect({
        activities: [
          {
            activityId: "1",
            type: "demo",
            description: "walkthrough",
            performedByUserId: "u1",
            performedByName: "Ada",
            performedAt: "2026-05-01T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(stamped.outreachTouchCount).toBe(1);
    expect(stamped.lastContactMethod).toBe("demo");
    expect(stamped.lastContactedBy).toBe("Ada");
  });
});
