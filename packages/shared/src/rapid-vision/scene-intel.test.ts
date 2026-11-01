import { describe, expect, it } from "vitest";
import {
  classifyRekognitionLabels,
  demoSceneAlerts,
  dispatcherCue,
  mockSceneNarrative,
  sceneAlertSuppressedByCooldown,
  summarizeSceneAlerts,
} from "./scene-intel.js";

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
      shortLabel: "Possible weapon",
    });
    expect(mockSceneNarrative("VISIBLE_WEAPON")).toContain("not a verified threat");
    expect(mockSceneNarrative("VISIBLE_WEAPON")).toContain("officer's own firearm");
  });

  it("returns null for motion-only frames with no operational labels", () => {
    expect(classifyRekognitionLabels([{ name: "Tree", confidence: 99, instances: 1 }])).toBeNull();
  });

  it("reads a weapon from the parent of a Rekognition handgun label", () => {
    const result = classifyRekognitionLabels([
      { name: "Pistol", confidence: 81, instances: 1, parents: ["Weapon"] },
    ]);
    expect(result?.eventType).toBe("VISIBLE_WEAPON");
  });

  it("maps a moderation violence label to an altercation", () => {
    const result = classifyRekognitionLabels([{ name: "Physical Violence", confidence: 88, instances: 1 }]);
    expect(result).toMatchObject({ eventType: "FIGHT_OR_ALTERCATION", severity: "critical" });
  });

  it("ignores a weak violence score", () => {
    expect(classifyRekognitionLabels([{ name: "Violence", confidence: 61, instances: 1 }])).toBeNull();
  });

  it("maps a trained Custom Labels class onto a dispatcher alert", () => {
    const result = classifyRekognitionLabels([{ name: "nexcort-altercation", confidence: 86, instances: 1 }]);
    expect(result).toMatchObject({ eventType: "FIGHT_OR_ALTERCATION", shortLabel: "Physical altercation" });
  });
});

describe("sceneAlertSuppressedByCooldown", () => {
  const now = Date.parse("2026-10-31T20:00:00.000Z");
  const recent = new Date(now - 30_000).toISOString();

  it("lets a weapon through while a crowd alert is still cooling down", () => {
    expect(
      sceneAlertSuppressedByCooldown({
        latest: {
          status: "active",
          timestamp: recent,
          eventType: "CROWD_FORMATION",
          severity: "medium",
        },
        nextEventType: "VISIBLE_WEAPON",
        nextSeverity: "high",
        cooldownSeconds: 120,
        now,
      }),
    ).toBe(false);
  });

  it("keeps a repeat of the same event quiet", () => {
    expect(
      sceneAlertSuppressedByCooldown({
        latest: {
          status: "active",
          timestamp: recent,
          eventType: "VISIBLE_WEAPON",
          severity: "high",
        },
        nextEventType: "VISIBLE_WEAPON",
        nextSeverity: "high",
        cooldownSeconds: 120,
        now,
      }),
    ).toBe(true);
  });
});

describe("dispatcherCue", () => {
  it("tells the dispatcher to confirm a weapon before dispatch", () => {
    expect(dispatcherCue("VISIBLE_WEAPON")).toContain("confirm before dispatch");
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

describe("summarizeSceneAlerts", () => {
  it("computes conversion rate without dividing by zero", () => {
    expect(summarizeSceneAlerts([]).conversionRate).toBe(0);
    const alerts = demoSceneAlerts("a1");
    alerts[0]!.status = "incident_created";
    const summary = summarizeSceneAlerts(alerts);
    expect(summary.totalAlerts).toBe(3);
    expect(summary.incidentCreatedCount).toBe(1);
    expect(summary.conversionRate).toBeCloseTo(1 / 3);
  });
});

describe("mockSceneNarrative", () => {
  it("returns the spec altercation copy for fight events", () => {
    expect(mockSceneNarrative("FIGHT_OR_ALTERCATION")).toContain("Physical altercation");
  });
});
