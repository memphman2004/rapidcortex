import { describe, expect, it } from "vitest";
import { isVenueGuestServicesRole } from "./venue-guest-services";

describe("isVenueGuestServicesRole", () => {
  it("recognizes canonical and alias guest-services tokens", () => {
    expect(isVenueGuestServicesRole("venue_guest")).toBe(true);
    expect(isVenueGuestServicesRole("VENUE_GUEST_SERVICES")).toBe(true);
    expect(isVenueGuestServicesRole("venue-guest-services")).toBe(true);
    expect(isVenueGuestServicesRole("venue_admin")).toBe(false);
  });
});
