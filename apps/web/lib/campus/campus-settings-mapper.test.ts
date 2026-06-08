import { describe, expect, it } from "vitest";
import { campusPatchFromSettingsView, campusSettingsFromAgency } from "./campus-settings-mapper";

describe("campus settings mapper", () => {
  it("maps agency campus config to settings view", () => {
    const view = campusSettingsFromAgency({
      agencyId: "test-campus-csu",
      name: "CSU Safety",
      type: "campus",
      status: "active",
      config: {
        agencyId: "test-campus-csu",
        campus: {
          displayName: "Columbus State Safety",
          campusType: "university",
          timezone: "America/New_York",
          publicReportForm: {
            headline: "Report a concern",
            emergencyDisclaimer: "Call 911 for emergencies.",
          },
        },
      },
    } as never);

    expect(view.general.displayName).toBe("Columbus State Safety");
    expect(view.publicForm.title).toBe("Report a concern");
    expect(view.publicForm.disclaimerText).toContain("911");
  });

  it("maps settings view patch back to agency campus config", () => {
    const patch = campusPatchFromSettingsView({
      general: { displayName: "Updated Campus Name" },
      escalation: {
        enabled: true,
        thresholdMinutes: 20,
        escalationContacts: [{ name: "Director", email: "dir@school.edu", phone: "" }],
      },
    });

    expect(patch.name).toBe("Updated Campus Name");
    expect(patch.campus.escalation?.enabled).toBe(true);
    expect(patch.campus.escalation?.unacknowledgedMinutes).toBe(20);
    expect(patch.campus.escalation?.contacts?.[0]?.name).toBe("Director");
  });

  it("round-trips campusType, timezone, escalation, and disclaimer without data loss", () => {
    const sourceAgency = {
      agencyId: "test-campus-csu",
      name: "Columbus State University",
      type: "campus",
      status: "active",
      config: {
        agencyId: "test-campus-csu",
        campus: {
          displayName: "Columbus State University",
          campusType: "university",
          timezone: "America/Chicago",
          escalation: {
            enabled: true,
            unacknowledgedMinutes: 25,
            contacts: [{ name: "Campus Police", email: "police@csu.edu" }],
          },
          publicReportForm: {
            headline: "Report a concern",
            emergencyDisclaimer: "Call 911 for life-threatening emergencies.",
          },
        },
      },
    } as never;

    const view = campusSettingsFromAgency(sourceAgency);
    const patch = campusPatchFromSettingsView(view);
    const roundTripAgency = {
      ...sourceAgency,
      name: patch.name ?? sourceAgency.name,
      config: {
        ...sourceAgency.config,
        campus: {
          ...sourceAgency.config.campus,
          ...patch.campus,
        },
      },
    };
    const roundTrip = campusSettingsFromAgency(roundTripAgency);

    expect(roundTrip.general.campusType).toBe("university");
    expect(roundTrip.general.timezone).toBe("America/Chicago");
    expect(roundTrip.escalation.enabled).toBe(true);
    expect(roundTrip.publicForm.disclaimerText).toBe(
      "Call 911 for life-threatening emergencies.",
    );
  });
});
