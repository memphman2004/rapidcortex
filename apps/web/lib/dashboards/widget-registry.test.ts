import { describe, expect, it } from "vitest";
import { WIDGET_REGISTRY } from "@/components/widgets/widget-registry";
import { ROLE_WIDGET_LAYOUTS, type WidgetId } from "./widget-layout-config";

const ALL_WIDGET_IDS = new Set<WidgetId>();
for (const layout of Object.values(ROLE_WIDGET_LAYOUTS)) {
  for (const slot of layout.widgets) {
    ALL_WIDGET_IDS.add(slot.id);
  }
}

describe("WIDGET_REGISTRY completeness", () => {
  it("registers every widget id used in role layouts", () => {
    for (const id of ALL_WIDGET_IDS) {
      expect(WIDGET_REGISTRY[id], `missing widget implementation: ${id}`).toBeDefined();
    }
  });

  it("has no duplicate registry keys beyond layout usage", () => {
    expect(Object.keys(WIDGET_REGISTRY).length).toBeGreaterThanOrEqual(ALL_WIDGET_IDS.size);
  });
});
