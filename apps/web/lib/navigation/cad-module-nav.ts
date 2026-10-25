import type { NavItem, RoleNav } from "./role-nav";

export function cadModuleNavItem(jurisdiction: string): NavItem {
  return {
    id: "cad-module",
    label: "CAD",
    href: `/${jurisdiction}/cad`,
    icon: "Radio",
    exact: true,
  };
}

/**
 * Adds the licensed CAD entry when both gates are on.
 * Existing nav items, including Dispatcher, stay as they are.
 */
export function withCadModuleNav(nav: RoleNav, jurisdiction: string, visible: boolean): RoleNav {
  if (!visible) return nav;
  const item = cadModuleNavItem(jurisdiction);
  return {
    ...nav,
    sections: nav.sections.map((section, index) => {
      if (index !== 0 || section.items.some((entry) => entry.id === "cad-module")) return section;
      const dashboardAt = section.items.findIndex((entry) => entry.id === "dashboard");
      const items = [...section.items];
      items.splice(dashboardAt >= 0 ? dashboardAt + 1 : 0, 0, item);
      return { ...section, items };
    }),
  };
}
