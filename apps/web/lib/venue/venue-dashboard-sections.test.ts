import { describe, expect, it } from "vitest";
import { getVenueDashboardSections, normalizeVenueRole } from "./venue-dashboard-sections";

describe("venue dashboard sections", () => {
  it("guest services sees reports only — no dispatch-style ops table", () => {
    const gs = getVenueDashboardSections("VENUE_GUEST_SERVICES");
    expect(gs.activeIncidentsTable).toBe(false);
    expect(gs.opsStats).toBe(false);
    expect(gs.guestReportsFeed).toBe(true);
  });

  it("operator sees incident queue without cameras or staff panels", () => {
    const op = getVenueDashboardSections("VENUE_OPERATOR");
    expect(op.activeIncidentsTable).toBe(true);
    expect(op.cameraHealth).toBe(false);
    expect(op.staffStatusPanel).toBe(false);
  });

  it("normalizes unknown roles to supervisor default", () => {
    expect(normalizeVenueRole("")).toBe("VENUE_SUPERVISOR");
  });
});
