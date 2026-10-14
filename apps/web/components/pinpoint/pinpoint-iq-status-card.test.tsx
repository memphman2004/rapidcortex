/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resolvePinpointIqLocationStatus } from "rapid-cortex-shared/pinpoint-surge";
import { PinpointIqStatusCard } from "./pinpoint-iq-status-card";

describe("PinpointIqStatusCard", () => {
  afterEach(() => cleanup());

  it("renders LIVE with last update and accuracy", () => {
    const nowMs = Date.now();
    const view = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: new Date(nowMs - 60_000).toISOString(),
      expiresAt: new Date(nowMs + 30 * 60_000).toISOString(),
      nowMs,
      pings: [
        {
          capturedAt: new Date(nowMs - 8_000).toISOString(),
          lat: 39.16,
          lng: -86.52,
          accuracyM: 12,
        },
      ],
      freshnessSeconds: 30,
    });
    render(
      <PinpointIqStatusCard view={view} scanLocationLabel="Library — Main Entrance" />,
    );
    expect(screen.getByText("Pinpoint iQ")).toBeTruthy();
    expect(screen.getByLabelText(/Location status: LIVE/i)).toBeTruthy();
    expect(screen.getByText(/±12 meters/i)).toBeTruthy();
    expect(screen.getByText(/Library — Main Entrance/i)).toBeTruthy();
  });

  it("renders SCAN ONLY when no session and a scan location exists", () => {
    const view = resolvePinpointIqLocationStatus({
      hasTrackingSession: false,
      hasScanLocation: true,
    });
    render(<PinpointIqStatusCard view={view} scanLocationLabel="Library — Main Entrance" />);
    expect(screen.getByLabelText(/Location status: SCAN ONLY/i)).toBeTruthy();
    expect(screen.getByText(/original QR\/NFC scan point/i)).toBeTruthy();
  });
});
