/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampusLiveLocationShare } from "./campus-live-location-share";

describe("CampusLiveLocationShare", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("watchPosition posts pings to the public Pinpoint location API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      ...navigator,
      sendBeacon: vi.fn(() => true),
      geolocation: {
        watchPosition: (
          success: PositionCallback,
          _err?: PositionErrorCallback,
        ) => {
          // Fire one fix asynchronously so React effects settle first.
          queueMicrotask(() => {
            success({
              coords: {
                latitude: 39.1653,
                longitude: -86.5264,
                accuracy: 12,
                altitude: null,
                altitudeAccuracy: null,
                heading: 90,
                speed: 0.5,
              },
              timestamp: Date.now(),
            } as GeolocationPosition);
          });
          return 42;
        },
        clearWatch: vi.fn(),
      },
    });

    render(<CampusLiveLocationShare token="track-token-1" />);

    expect(screen.getByText(/Sharing live location|Location sharing stopped/i)).toBeTruthy();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const locationCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/location"),
    ) as [string, RequestInit];
    expect(locationCall).toBeTruthy();
    expect(locationCall[0]).toBe("/api/public/pinpoint/track-token-1/location");
    expect(locationCall[1].method).toBe("POST");
    const body = JSON.parse(String(locationCall[1].body)) as { lat: number; lng: number };
    expect(body.lat).toBeCloseTo(39.1653);
    expect(body.lng).toBeCloseTo(-86.5264);

    await waitFor(() => {
      expect(screen.getByText(/1 update sent/i)).toBeTruthy();
    });
  });

  it("Stop sharing clears watch, calls revoke, and does not claim success on failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => "" }) // first location
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" }); // revoke fail
    const clearWatch = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      ...navigator,
      sendBeacon: vi.fn(() => true),
      geolocation: {
        watchPosition: (success: PositionCallback) => {
          queueMicrotask(() => {
            success({
              coords: {
                latitude: 1,
                longitude: 2,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            } as GeolocationPosition);
          });
          return 7;
        },
        clearWatch,
      },
    });

    render(<CampusLiveLocationShare token="tok-2" />);
    await waitFor(() => expect(screen.getByText(/Stop sharing/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Stop sharing/i }));

    await waitFor(() => {
      expect(clearWatch).toHaveBeenCalled();
      expect(
        fetchMock.mock.calls.some(
          (c) => String(c[0]).endsWith("/revoke") && (c[1] as RequestInit).method === "POST",
        ),
      ).toBe(true);
      expect(screen.getByText(/did not confirm revocation/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Retry confirm stop/i })).toBeTruthy();
    });
  });
});
