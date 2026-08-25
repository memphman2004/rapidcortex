import { describe, expect, it } from "vitest";
import {
  applyConferenceChange,
  detectConferenceChanges,
  dismissConferenceChange,
} from "./conference-change.js";
import {
  PLATFORM_CONFERENCE_AGENCY_ID,
  isSignificantConferenceChange,
  type Conference,
  type ExtractedConferenceData,
} from "./conference-schemas.js";

function conf(overrides: Partial<Conference> = {}): Conference {
  return {
    conferenceId: "c1",
    agencyId: PLATFORM_CONFERENCE_AGENCY_ID,
    name: "APCO 2026",
    website: "https://www.apco911.org/annual-conference",
    sourceUrl: "https://www.apco911.org/annual-conference",
    startDate: "2026-08-16",
    endDate: "2026-08-19",
    location: "Orlando, FL",
    venue: "Orange County Convention Center",
    registrationDeadline: "2026-07-01",
    isCancelled: false,
    changeHistory: [],
    autoUpdateEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function extracted(overrides: Partial<ExtractedConferenceData> = {}): ExtractedConferenceData {
  return {
    startDate: "2026-08-16",
    endDate: "2026-08-19",
    location: "Orlando, FL",
    venue: "Orange County Convention Center",
    registrationDeadline: "2026-07-01",
    isCancelled: false,
    isPostponed: false,
    newDatesTBD: false,
    confidence: "confirmed",
    rawDateText: "August 16–19, 2026",
    rawLocationText: "Orlando, FL",
    notes: null,
    ...overrides,
  };
}

const NOW = "2026-08-18T09:00:00.000Z";
let seq = 0;
const id = () => `chg_${++seq}`;

describe("detectConferenceChanges", () => {
  it("records no change when extracted data matches stored values", () => {
    expect(detectConferenceChanges(conf(), extracted(), { now: NOW, id })).toEqual([]);
  });

  it("records a dates change when startDate differs and confidence is confirmed", () => {
    const changes = detectConferenceChanges(
      conf(),
      extracted({ startDate: "2026-09-12", endDate: "2026-09-15" }),
      { now: NOW, id },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]?.changeType).toBe("dates");
    expect(changes[0]?.previousValue).toBe("2026-08-16 – 2026-08-19");
    expect(changes[0]?.newValue).toBe("2026-09-12 – 2026-09-15");
    expect(isSignificantConferenceChange(changes[0]!.changeType)).toBe(true);
  });

  it("does not flag a change when confidence is possible", () => {
    const changes = detectConferenceChanges(
      conf(),
      extracted({ startDate: "2026-09-12", confidence: "possible" }),
      { now: NOW, id },
    );
    expect(changes).toEqual([]);
  });

  it("does flag a change when confidence is likely", () => {
    const changes = detectConferenceChanges(
      conf(),
      extracted({ startDate: "2026-09-12", endDate: "2026-09-15", confidence: "likely" }),
      { now: NOW, id },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]?.confidence).toBe("likely");
  });

  it("records location change case-insensitively", () => {
    const changes = detectConferenceChanges(
      conf(),
      extracted({ location: "Denver, CO" }),
      { now: NOW, id },
    );
    expect(changes.map((c) => c.changeType)).toEqual(["location"]);
  });

  it("records cancellation as a significant change", () => {
    const changes = detectConferenceChanges(conf(), extracted({ isCancelled: true }), { now: NOW, id });
    expect(changes[0]?.changeType).toBe("cancelled");
    expect(isSignificantConferenceChange("cancelled")).toBe(true);
  });

  it("records dates-announced when stored start was TBD", () => {
    const changes = detectConferenceChanges(
      conf({ startDate: "TBD" }),
      extracted({ startDate: "2026-10-01", endDate: "2026-10-03" }),
      { now: NOW, id },
    );
    expect(changes.map((c) => c.changeType)).toEqual(["dates-announced"]);
  });

  it("does not treat venue as significant for alerts", () => {
    expect(isSignificantConferenceChange("venue")).toBe(false);
  });
});

describe("apply and dismiss", () => {
  it("applies a dates change onto the stored record", () => {
    const [change] = detectConferenceChanges(
      conf(),
      extracted({ startDate: "2026-09-12", endDate: "2026-09-15" }),
      { now: NOW, id },
    );
    const next = applyConferenceChange(conf({ changeHistory: [change!] }), change!);
    expect(next.startDate).toBe("2026-09-12");
    expect(next.endDate).toBe("2026-09-15");
    expect(next.changeHistory[0]?.status).toBe("applied");
  });

  it("dismiss hides the badge without changing dates", () => {
    const [change] = detectConferenceChanges(
      conf(),
      extracted({ startDate: "2026-09-12", endDate: "2026-09-15" }),
      { now: NOW, id },
    );
    const stored = conf({ changeHistory: [change!] });
    const next = dismissConferenceChange(stored, change!.changeId);
    expect(next.startDate).toBe("2026-08-16");
    expect(next.changeHistory[0]?.status).toBe("dismissed");
  });
});
