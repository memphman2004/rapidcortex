import { describe, expect, it } from "vitest";
import type { Conference } from "rapid-cortex-shared";
import {
  compareConferences,
  conferencePriorityCounts,
  conferencePriorityLabel,
  filterConferencesByPriority,
  formatCheckedAgo,
  formatConferenceDates,
  groupConferencesByPriority,
} from "./format";

describe("conference format helpers", () => {
  it("formats a same-month date range", () => {
    expect(formatConferenceDates("2026-08-16", "2026-08-19")).toBe("Aug 16–19, 2026");
  });

  it("formats TBD", () => {
    expect(formatConferenceDates("TBD")).toBe("Dates TBD");
  });

  it("formats last-checked relative days", () => {
    const now = Date.parse("2026-08-21T09:00:00.000Z");
    expect(formatCheckedAgo("2026-08-18T09:00:00.000Z", now)).toBe("Checked 3 days ago");
    expect(formatCheckedAgo("2026-08-21T08:00:00.000Z", now)).toBe("Checked today");
    expect(formatCheckedAgo(undefined, now)).toBe("Never checked");
  });
});

function conference(partial: Partial<Conference> & Pick<Conference, "name" | "startDate">): Conference {
  return {
    conferenceId: partial.conferenceId ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    agencyId: "platform",
    website: "https://example.com",
    sourceUrl: "https://example.com",
    location: "TBD",
    changeHistory: [],
    autoUpdateEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("compareConferences", () => {
  it("sorts TBD dates after dated events", () => {
    const dated = conference({ name: "GECC", startDate: "2027-03-07", location: "Columbus, Georgia" });
    const tbd = conference({ name: "APCO", startDate: "TBD", location: "TBD" });
    expect(compareConferences(dated, tbd, "dates")).toBeLessThan(0);
  });

  it("sorts by location", () => {
    const a = conference({ name: "GECC", startDate: "2027-03-07", location: "Columbus, Georgia" });
    const b = conference({ name: "APCO", startDate: "TBD", location: "TBD" });
    expect(compareConferences(a, b, "location")).toBeLessThan(0);
  });
});

describe("conference priority grouping", () => {
  const notAttending = conference({ name: "VenuesNow", startDate: "2026-09-29", priority: "red" });
  const maybe = conference({ name: "GSX", startDate: "2026-09-14", priority: "amber" });
  const going = conference({ name: "GECC", startDate: "2027-03-07", priority: "green" });
  const unset = conference({ name: "IACP", startDate: "2026-10-12" });

  it("treats missing priority as amber (maybe)", () => {
    expect(conferencePriorityCounts([notAttending, maybe, going, unset])).toEqual({
      all: 4,
      red: 1,
      amber: 2,
      green: 1,
    });
  });

  it("filters by color", () => {
    expect(filterConferencesByPriority([notAttending, maybe, going], "amber")).toEqual([maybe]);
  });

  it("groups going then maybe then not attending and hides empty groups", () => {
    const groups = groupConferencesByPriority([going, notAttending]);
    expect(groups.map((g) => g.priority)).toEqual(["green", "red"]);
    expect(groups[0]?.items).toEqual([going]);
  });

  it("labels colors as going / maybe / not attending", () => {
    expect(conferencePriorityLabel("green")).toBe("Green — going");
    expect(conferencePriorityLabel("amber")).toBe("Amber — maybe");
    expect(conferencePriorityLabel("red")).toBe("Red — not attending");
  });
});
