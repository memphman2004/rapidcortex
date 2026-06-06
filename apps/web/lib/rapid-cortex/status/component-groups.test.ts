import { describe, expect, it } from "vitest";
import { getStatusComponents } from "@/lib/rapid-cortex/status/status-data";
import { STATUS_COMPONENT_GROUPS, groupStatusComponents } from "@/lib/rapid-cortex/status/component-groups";

describe("status component groups", () => {
  it("assigns every known component to exactly one group", () => {
    const components = getStatusComponents();
    const grouped = groupStatusComponents(components);
    const seen = new Set<string>();
    for (const { components: list } of grouped) {
      for (const c of list) {
        expect(seen.has(c.id)).toBe(false);
        seen.add(c.id);
      }
    }
    expect(seen.size).toBe(components.length);
    expect(STATUS_COMPONENT_GROUPS).toHaveLength(4);
  });
});
