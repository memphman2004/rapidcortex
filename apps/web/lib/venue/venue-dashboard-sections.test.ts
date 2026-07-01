import { describe, expect, it } from "vitest";
import { getWidgetLayout } from "@/lib/dashboards/widget-layout-config";
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

  it("normalizes venue_guest to guest services — never supervisor", () => {
    expect(normalizeVenueRole("venue_guest")).toBe("VENUE_GUEST_SERVICES");
    expect(normalizeVenueRole("VENUE_GUEST")).toBe("VENUE_GUEST_SERVICES");
    expect(normalizeVenueRole("venue-guest-services")).toBe("VENUE_GUEST_SERVICES");
  });

  it("normalizes unknown roles to supervisor default", () => {
    expect(normalizeVenueRole("")).toBe("VENUE_SUPERVISOR");
  });

  it("resolves widget layouts for migrated venue roles", () => {
    expect(getWidgetLayout("venue_admin")?.greeting).toBe("Venue Operations");
    expect(getWidgetLayout("venue_guest")?.widgets.map((w) => w.id)).toEqual(["guest-reports-feed"]);
  });
});
