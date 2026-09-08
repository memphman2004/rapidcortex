import { describe, expect, it } from "vitest";
import { correlateOpenIncidentsInZone } from "./schemas.js";

describe("physical security zone correlation", () => {
  const now = new Date("2026-09-08T16:00:00.000Z");

  it("links open incidents in the same zone within 10 minutes", () => {
    const ids = correlateOpenIncidentsInZone(
      [
        {
          incidentId: "a",
          zoneCode: "GATE-12",
          status: "open",
          createdAt: "2026-09-08T15:55:00.000Z",
        },
        {
          incidentId: "b",
          zoneCode: "GATE-12",
          status: "resolved",
          createdAt: "2026-09-08T15:55:00.000Z",
        },
        {
          incidentId: "c",
          zoneCode: "GATE-9",
          status: "open",
          createdAt: "2026-09-08T15:55:00.000Z",
        },
        {
          incidentId: "d",
          zoneCode: "GATE-12",
          status: "open",
          createdAt: "2026-09-08T15:40:00.000Z",
        },
      ],
      "gate-12",
      now,
    );
    expect(ids).toEqual(["a"]);
  });
});
