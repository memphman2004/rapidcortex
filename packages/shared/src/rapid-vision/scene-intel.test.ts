import { describe, expect, it } from "vitest";
import { classifyRekognitionLabels, demoSceneAlerts } from "./scene-intel.js";

describe("classifyRekognitionLabels", () => {
  it("maps fight labels to a critical altercation alert", () => {
    const result = classifyRekognitionLabels([
      { name: "Person", confidence: 99, instances: 3 },
      { name: "Fight", confidence: 91, instances: 1 },
    ]);
    expect(result).toMatchObject({
      eventType: "FIGHT_OR_ALTERCATION",
      severity: "critical",
      shortLabel: "Physical altercation",
    });
  });

  it("treats weapons as situational high — never auto-dispatch certainty", () => {
    const result = classifyRekognitionLabels([{ name: "Gun", confidence: 72, instances: 1 }]);
    expect(result).toMatchObject({
      eventType: "VISIBLE_WEAPON",
      severity: "high",
      confidence: "LOW",
    });
  });

  it("returns null for motion-only frames with no operational labels", () => {
    expect(classifyRekognitionLabels([{ name: "Tree", confidence: 99, instances: 1 }])).toBeNull();
  });
});

describe("demoSceneAlerts", () => {
  it("seeds three agency-scoped dispatcher cards", () => {
    const alerts = demoSceneAlerts("test-agency");
    expect(alerts).toHaveLength(3);
    expect(new Set(alerts.map((a) => a.agencyId))).toEqual(new Set(["test-agency"]));
    expect(alerts.map((a) => a.eventId).sort()).toEqual([
      "scene-demo-altercation",
      "scene-demo-persondown",
      "scene-demo-vehicle",
    ]);
    expect(alerts.every((a) => a.status === "active")).toBe(true);
  });
});
