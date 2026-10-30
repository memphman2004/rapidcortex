import { describe, expect, it } from "vitest";
import {
  isActiveCallWorkspace,
  showSceneAlertPulse,
} from "./scene-alert-audience";

describe("scene alert audience", () => {
  it("does not pulse a PSAP call-taker, including on the live call screen", () => {
    expect(
      showSceneAlertPulse({
        role: "dispatcher",
        pathname: "/kc/dispatcher",
        pulsing: true,
      }),
    ).toBe(false);
    expect(
      showSceneAlertPulse({
        role: "dispatcher",
        pathname: "/kc/dashboard",
        pulsing: true,
      }),
    ).toBe(false);
  });

  it("pulses the watch desk until the alert is still unacknowledged", () => {
    expect(
      showSceneAlertPulse({
        role: "supervisor",
        pathname: "/kc/supervisor",
        pulsing: true,
      }),
    ).toBe(true);
  });

  it("keeps the watch-desk pulse on every screen, including a live call workspace, until acknowledgment", () => {
    expect(isActiveCallWorkspace("/kc/dispatcher")).toBe(true);
    expect(
      showSceneAlertPulse({
        role: "supervisor",
        pathname: "/kc/dispatcher",
        pulsing: true,
      }),
    ).toBe(true);
    expect(
      showSceneAlertPulse({
        role: "supervisor",
        pathname: "/kc/supervisor",
        pulsing: true,
      }),
    ).toBe(true);
  });

  it("stops showing the pulse only when nothing unacknowledged remains", () => {
    expect(
      showSceneAlertPulse({
        role: "supervisor",
        pathname: "/kc/supervisor",
        pulsing: false,
      }),
    ).toBe(false);
  });
});
