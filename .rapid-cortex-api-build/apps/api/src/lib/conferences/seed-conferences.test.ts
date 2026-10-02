import { describe, expect, it } from "vitest";
import { DEFAULT_CONFERENCES } from "./seed-conferences.js";

describe("DEFAULT_CONFERENCES NSA 2027", () => {
  it("includes the winter and annual sheriffs conferences", () => {
    const winter = DEFAULT_CONFERENCES.find((row) => row.conferenceId === "conf-nsa-winter-2027");
    const annual = DEFAULT_CONFERENCES.find((row) => row.conferenceId === "conf-nsa-annual-2027");

    expect(winter).toMatchObject({
      name: "NSA Winter Conference 2027",
      startDate: "2027-02-08",
      endDate: "2027-02-12",
      location: "Washington, DC",
      venue: "Omni Shoreham Hotel",
      website: "https://www.sheriffs.org",
      boothFee: "$2,250 per 8×6 tabletop",
    });
    expect(annual).toMatchObject({
      name: "NSA Annual Conference 2027",
      startDate: "2027-06-21",
      endDate: "2027-06-24",
      location: "Charlotte, North Carolina",
      venue: "Charlotte Convention Center",
      sourceUrl: "https://www.nsaconference.org/exhibit-nsa-conference/",
      boothFee: "$2,950 per 10×10; +$200 corner",
    });
  });
});

describe("DEFAULT_CONFERENCES NSSSC Houston 2026", () => {
  it("includes the National Student Safety & Security Conference Houston stop", () => {
    const houston = DEFAULT_CONFERENCES.find((row) => row.conferenceId === "conf-nsssc-houston-2026");
    expect(houston).toMatchObject({
      name: "NSSSC Houston 2026 — National Student Safety & Security Conference",
      startDate: "2026-10-28",
      endDate: "2026-10-30",
      location: "Houston, Texas",
      website: "https://insssc.com/nsssc-2026/houston/",
      sourceUrl: "https://insssc.com/nsssc-2026/houston/sponsors-exhibitors/",
      registrationFee: "$1,455 commercial / $1,250 education-gov (conference); workshop +$100",
      boothFee: "$4,995 Silver (6′ table, 2 passes); Gold $7,995–Titanium $15,995",
      vertical: "campus",
    });
  });
});
