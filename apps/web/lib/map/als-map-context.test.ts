/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

describe("ALSMapProvider ready gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays not-ready on first paint, then ready after proxy transform is registered", async () => {
    vi.stubEnv("NEXT_PUBLIC_ALS_USE_BROWSER_COGNITO", "");
    vi.stubEnv("NEXT_PUBLIC_ALS_IDENTITY_POOL_ID", "us-east-1:test-pool");

    const setMapTransformRequest = vi.fn();
    const markMapAuthReady = vi.fn();
    vi.doMock("rapid-cortex-maps", () => ({
      alsMapStyleUrl: (theme: string) =>
        `https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?t=${theme}`,
      setMapTransformRequest,
      markMapAuthReady,
    }));
    vi.doMock("@aws/amazon-location-utilities-auth-helper", () => ({
      withIdentityPoolId: vi.fn(),
    }));

    const { ALSMapProvider, useALSMap } = await import("./als-map-context");

    const snapshots: boolean[] = [];
    function Probe() {
      const { ready } = useALSMap();
      snapshots.push(ready);
      return null;
    }

    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);

    flushSync(() => {
      root.render(
        React.createElement(ALSMapProvider, null, React.createElement(Probe)),
      );
    });

    // First paint must be not-ready so MapLibre cannot mount without the proxy.
    expect(snapshots[0]).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(snapshots.some((r) => r === true)).toBe(true);
    expect(setMapTransformRequest).toHaveBeenCalled();
    expect(markMapAuthReady).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    el.remove();
  });
});
