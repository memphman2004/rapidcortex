import { isNavFeatureEnabled } from "./nav-feature-gates";
import type { NavItem, RoleNav } from "./role-nav";

function filterNavItem(item: NavItem): NavItem | null {
  if (item.feature && !isNavFeatureEnabled(item.feature)) return null;
  if (!item.children?.length) return item;
  const children = item.children
    .map(filterNavItem)
    .filter((child): child is NavItem => child != null);
  return { ...item, children };
}

export function filterRoleNavByFeatures(nav: RoleNav): RoleNav {
  return {
    ...nav,
    sections: nav.sections
      .map((section) => ({
        ...section,
        items: section.items
          .map(filterNavItem)
          .filter((item): item is NavItem => item != null),
      }))
      .filter((section) => section.items.length > 0),
  };
}
