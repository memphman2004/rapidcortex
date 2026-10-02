import { afterEach, describe, expect, it } from "vitest";
import {
  MilestoneBridgeClient,
  MilestoneBridgeNotConfiguredError,
  milestoneMockEnabled,
} from "./milestone-bridge-client.js";

describe("MilestoneBridgeClient", () => {
  afterEach(() => {
    delete process.env.MILESTONE_MOCK;
  });

  it("treats MILESTONE_MOCK=1 as the legacy flag without fabricating a bridge", () => {
    process.env.MILESTONE_MOCK = "1";
    expect(milestoneMockEnabled()).toBe(true);
  });

  it("does not invent cameras when the mock flag is set and no bridge URL is configured", async () => {
    process.env.MILESTONE_MOCK = "1";
    const client = new MilestoneBridgeClient({ bridgeBaseUrl: "" });
    await expect(client.listCameras()).rejects.toBeInstanceOf(MilestoneBridgeNotConfiguredError);
    await expect(client.requestLive("cam-1", { format: "hls" })).rejects.toBeInstanceOf(
      MilestoneBridgeNotConfiguredError,
    );
    await expect(
      client.sendEvent({ agencyId: "a1", incidentId: "inc-1", title: "test" }),
    ).rejects.toBeInstanceOf(MilestoneBridgeNotConfiguredError);
    await expect(
      client.sendAlarm({ agencyId: "a1", incidentId: "inc-1", message: "test" }),
    ).rejects.toBeInstanceOf(MilestoneBridgeNotConfiguredError);
  });
});
