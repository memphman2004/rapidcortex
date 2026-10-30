import { describe, expect, it } from "vitest";
import {
  SCENE_RULES,
  SCENE_VERTICALS,
  handlingPulsesWatchDesk,
  suggestedHandling,
} from "./scene-monitoring-profiles";

describe("scene monitoring profiles", () => {
  it("gives every vertical a handling for every rule", () => {
    for (const vertical of SCENE_VERTICALS) {
      for (const rule of SCENE_RULES) {
        expect(suggestedHandling(vertical.id, rule.id)).toBeTruthy();
      }
    }
  });

  it("matches the campus examples", () => {
    expect(suggestedHandling("campus", "possible_fall")).toBe("review_alert");
    expect(suggestedHandling("campus", "person_down_public")).toBe("review_alert");
    expect(suggestedHandling("campus", "restricted_entry")).toBe("review_alert");
    expect(suggestedHandling("campus", "after_hours_parking")).toBe("low_priority");
    expect(suggestedHandling("campus", "altercation")).toBe("priority_review");
  });

  it("matches the venue examples", () => {
    expect(suggestedHandling("venue", "obstructed_exit")).toBe("priority_review");
    expect(suggestedHandling("venue", "crowd_congestion")).toBe("review_alert");
    expect(suggestedHandling("venue", "restricted_entry")).toBe("review_alert");
    expect(suggestedHandling("venue", "altercation")).toBe("priority_review");
  });

  it("matches the PSAP examples", () => {
    expect(suggestedHandling("psap", "vehicle_collision")).toBe("review_alert");
    expect(suggestedHandling("psap", "person_down_public")).toBe("review_alert");
    expect(suggestedHandling("psap", "roadway_obstruction")).toBe("review_alert");
    expect(suggestedHandling("psap", "altercation")).toBe("priority_review");
  });

  it("matches the transit examples", () => {
    expect(suggestedHandling("transit", "person_in_track")).toBe("priority_review");
    expect(suggestedHandling("transit", "platform_congestion")).toBe("review_alert");
    expect(suggestedHandling("transit", "person_down_public")).toBe("review_alert");
    expect(suggestedHandling("transit", "obstructed_exit")).toBe("priority_review");
  });

  it("treats a gym floor and a rail track as different events", () => {
    expect(suggestedHandling("campus", "person_down_athletic")).toBe("low_priority");
    expect(suggestedHandling("transit", "person_in_track")).toBe("priority_review");
    expect(handlingPulsesWatchDesk("low_priority")).toBe(false);
    expect(handlingPulsesWatchDesk("priority_review")).toBe(true);
    expect(handlingPulsesWatchDesk("health_only")).toBe(false);
  });
});
