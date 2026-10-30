import { describe, expect, it } from "vitest";
import {
  applySceneIncidentAction,
  buildSceneIncident,
  qualifyDetection,
  SCENE_DETECTION_CATEGORIES,
} from "./scene-incident";

const category = SCENE_DETECTION_CATEGORIES[0];

function sample() {
  return buildSceneIncident({
    id: "VSN-2026-00418",
    agencyId: "agency-a",
    cameraId: "cam-014",
    cameraName: "Camera 014",
    zoneLabel: "North Parking Garage",
    category,
    synthetic: true,
    modelVersion: "test-fixture",
    now: new Date("2026-10-29T23:42:15.000Z"),
  });
}

describe("scene incident qualification", () => {
  it("rejects a single frame, a lookalike, and an unapproved live model", () => {
    expect(qualifyDetection({ category: "firearm_like", frameCount: 1, synthetic: true }).ok).toBe(false);
    expect(
      qualifyDetection({ category: "firearm_like", frameCount: 4, negativeExample: true, synthetic: true }).ok,
    ).toBe(false);
    expect(qualifyDetection({ category: "firearm_like", frameCount: 4, synthetic: false }).ok).toBe(false);
    expect(qualifyDetection({ category: "suspicious_person", frameCount: 4, synthetic: true }).ok).toBe(false);
    expect(qualifyDetection({ category: "firearm_like", frameCount: 4, modelApproved: true, synthetic: true }).ok).toBe(
      false,
    );
  });

  it("accepts a labeled multi-frame test and does not create a CAD record", () => {
    const qualified = qualifyDetection({ category: "firearm_like", frameCount: 3, synthetic: true });
    expect(qualified.ok).toBe(true);
    const incident = sample();
    expect(incident.source).toBe("SCENE_INTELLIGENCE");
    expect(incident.label).toBe("AUTOMATED DETECTION — UNVERIFIED");
    expect(incident.cadCreatedBySystem).toBe(false);
    expect(incident.linkedCadIncidentId).toBeUndefined();
    expect(incident.activityLog.some((entry) => entry.text.includes("No CAD incident"))).toBe(true);
    expect(incident.activityLog.every((entry) => !/transcript of speech|said the caller/i.test(entry.text))).toBe(true);
  });
});

describe("scene incident actions", () => {
  it("finalizes the log on dismissal and refuses later notes", () => {
    const opened = sample();
    const dismissed = applySceneIncidentAction(opened, {
      type: "dismiss",
      operatorId: "op-1",
      reason: "Possible false positive",
      at: "2026-10-29T23:50:00.000Z",
    });
    expect(dismissed.ok).toBe(true);
    if (!dismissed.ok) return;
    expect(dismissed.incident.status).toBe("DISMISSED");
    expect(dismissed.incident.logFinalized).toBe(true);
    const late = applySceneIncidentAction(dismissed.incident, {
      type: "note",
      operatorId: "op-1",
      text: "late",
      at: "2026-10-29T23:51:00.000Z",
    });
    expect(late.ok).toBe(false);
  });

  it("does not mark dispatch confirmed unless a person supplies an existing CAD id", () => {
    const opened = sample();
    const blocked = applySceneIncidentAction(opened, {
      type: "authorize_dispatch",
      operatorId: "op-1",
      linkedCadIncidentId: "",
      cadConfirmed: false,
      at: "2026-10-29T23:50:00.000Z",
    });
    expect(blocked.ok).toBe(false);
    const confirmed = applySceneIncidentAction(opened, {
      type: "authorize_dispatch",
      operatorId: "op-1",
      linkedCadIncidentId: "CAD-100",
      cadConfirmed: true,
      at: "2026-10-29T23:50:00.000Z",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.incident.status).toBe("DISPATCHED");
    expect(confirmed.incident.linkedCadIncidentId).toBe("CAD-100");
    expect(confirmed.incident.cadCreatedBySystem).toBe(false);
    expect(confirmed.incident.logFinalized).toBe(true);
  });
});
