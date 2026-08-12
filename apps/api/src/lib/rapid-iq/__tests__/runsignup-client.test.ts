import { describe, expect, it } from "vitest";
import { buildRaceSignal, type RunSignUpRace } from "../runsignup-client.js";
import { VENUE_NEWS_SOURCES } from "../venue-news-sources.js";

const race: RunSignUpRace = {
  race_id: 1,
  name: "AJC Peachtree Road Race",
  next_date: "2026-07-04",
  next_end_date: "2026-07-04",
  address: { city: "Atlanta", state: "GA", zipcode: "30309" },
  url: "https://runsignup.com/Race/GA/Atlanta/Peachtree",
  registration_opens: "2026-01-01",
  max_participants: 60000,
  participant_cap: 60000,
  description: "World's largest 10K.",
  events: [{ event_id: 1, name: "10K", distance: "10K", registration_opens: "2026-01-01" }],
  race_director: { name: "Race Director", email: "rd@example.com" },
};

describe("runsignup-client", () => {
  it("builds a venue-oriented race signal", () => {
    const text = buildRaceSignal(race, 45);
    expect(text).toContain("AJC Peachtree Road Race");
    expect(text).toContain("Atlanta, GA");
    expect(text).toContain("Days until event: 45");
    expect(text).toContain("Rapid Cortex Venue");
  });
});

describe("venue-news-sources", () => {
  it("does not include BizBash", () => {
    expect(VENUE_NEWS_SOURCES.every((s) => !s.name.toLowerCase().includes("bizbash"))).toBe(true);
    expect(VENUE_NEWS_SOURCES.every((s) => !s.url.toLowerCase().includes("bizbash"))).toBe(true);
  });

  it("includes VenueConnect and Pollstar venue feeds", () => {
    expect(VENUE_NEWS_SOURCES.some((s) => s.url.includes("venuesnow.com/feed"))).toBe(true);
    expect(VENUE_NEWS_SOURCES.some((s) => s.url.includes("pollstar.com/category/venues/feed"))).toBe(
      true,
    );
  });
});
