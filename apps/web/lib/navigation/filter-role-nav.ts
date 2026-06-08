import { isNavFeatureEnabled } from "./nav-feature-gates";
import type { RoleNav } from "./role-nav";

export function filterRoleNavByFeatures(nav: RoleNav): RoleNav {
  return {
    ...nav,
    sections: nav.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !item.feature || isNavFeatureEnabled(item.feature),
        ),
      }))
      .filter((section) => section.items.length > 0),
  };
}
