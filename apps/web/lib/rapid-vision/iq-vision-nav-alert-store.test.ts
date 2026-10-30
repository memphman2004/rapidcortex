import { afterEach, describe, expect, it } from "vitest";
import {
  acknowledgeIqVisionIncident,
  acknowledgeIqVisionSceneAlerts,
  clearIqVisionNavAlerts,
  getIqVisionNavAlertSnapshot,
  setIqVisionViewingIncident,
  signalIqVisionNavAlert,
} from "./iq-vision-nav-alert-store";

afterEach(() => {
  clearIqVisionNavAlerts();
  setIqVisionViewingIncident(null);
});

describe("iq-vision-nav-alert-store", () => {
  it("pulses for a critical alert and stops only after explicit acknowledgment", () => {
    signalIqVisionNavAlert({ incidentId: "inc_1" });
    expect(getIqVisionNavAlertSnapshot().pulsing).toBe(true);
    expect(getIqVisionNavAlertSnapshot().focusIncidentId).toBe("inc_1");

    acknowledgeIqVisionIncident("inc_1");
    expect(getIqVisionNavAlertSnapshot().pulsing).toBe(false);
  });

  it("keeps other incidents pulsing when one is acknowledged", () => {
    signalIqVisionNavAlert({ incidentId: "inc_a" });
    signalIqVisionNavAlert({ incidentId: "inc_b" });
    acknowledgeIqVisionIncident("inc_a");
    const snap = getIqVisionNavAlertSnapshot();
    expect(snap.pulsing).toBe(true);
    expect(snap.focusIncidentId).toBe("inc_b");
  });

  it("clears scene-only alerts without dropping incident alerts", () => {
    signalIqVisionNavAlert({ eventId: "evt_1" });
    signalIqVisionNavAlert({ incidentId: "inc_1" });
    acknowledgeIqVisionSceneAlerts();
    const snap = getIqVisionNavAlertSnapshot();
    expect(snap.pulsing).toBe(true);
    expect(snap.focusIncidentId).toBe("inc_1");
    expect(snap.alerts.some((a) => a.eventId === "evt_1")).toBe(false);
  });

  it("keeps pulsing when the operator is only viewing the incident", () => {
    setIqVisionViewingIncident("inc_view");
    signalIqVisionNavAlert({ incidentId: "inc_view" });
    expect(getIqVisionNavAlertSnapshot().pulsing).toBe(true);
    expect(getIqVisionNavAlertSnapshot().criticalCount).toBe(1);
  });
});
