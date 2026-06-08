import { describe, expect, it } from "vitest";
import { getWidgetLayout, resolveWidgetLayoutRole, ROLE_WIDGET_LAYOUTS } from "./widget-layout-config";

const ALL_LAYOUT_ROLES = Object.keys(ROLE_WIDGET_LAYOUTS);

describe("widget-layout-config", () => {
  it("defines layouts for all 21 active roles", () => {
    expect(ALL_LAYOUT_ROLES).toHaveLength(21);
  });

  it.each(ALL_LAYOUT_ROLES)("resolves layout for %s", (role) => {
    const layout = getWidgetLayout(role);
    expect(layout).not.toBeNull();
    expect(layout!.widgets.length).toBeGreaterThan(0);
  });

  it("maps legacy hospital roles to hospital layouts", () => {
    expect(resolveWidgetLayoutRole("hospitaladmin")).toBe("HOSPITAL_ADMIN");
    expect(resolveWidgetLayoutRole("hospitalstaff")).toBe("HOSPITAL_STAFF");
    expect(getWidgetLayout("hospitaladmin")?.greeting).toBe(
      getWidgetLayout("HOSPITAL_ADMIN")?.greeting,
    );
  });

  it("normalizes campus and venue role tokens", () => {
    expect(resolveWidgetLayoutRole("campus_admin")).toBe("CAMPUS_ADMIN");
    expect(resolveWidgetLayoutRole("CAMPUS_ADMIN")).toBe("CAMPUS_ADMIN");
    expect(resolveWidgetLayoutRole("venue_operator")).toBe("VENUE_OPERATOR");
    expect(resolveWidgetLayoutRole("VENUE_OPERATOR")).toBe("VENUE_OPERATOR");
  });
});
