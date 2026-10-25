import { describe, expect, it } from "vitest";
import { getDispatcherNav } from "./role-nav";
import { withCadModuleNav } from "./cad-module-nav";

describe("withCadModuleNav", () => {
  it("leaves the dispatcher workspace in place and omits CAD until the license is on", () => {
    const nav = getDispatcherNav("metro");
    const hidden = withCadModuleNav(nav, "metro", false);
    const ids = hidden.sections.flatMap((section) => section.items.map((item) => item.id));
    expect(ids).toContain("dispatcher");
    expect(ids).not.toContain("cad-module");
  });

  it("inserts CAD after Dashboard when the user is licensed", () => {
    const nav = withCadModuleNav(getDispatcherNav("metro"), "metro", true);
    const items = nav.sections[0]?.items ?? [];
    const dashboard = items.findIndex((item) => item.id === "dashboard");
    expect(items[dashboard + 1]).toMatchObject({ id: "cad-module", href: "/metro/cad", label: "CAD" });
    expect(items.some((item) => item.id === "dispatcher")).toBe(true);
  });
});
