import { afterEach, describe, expect, it, vi } from "vitest";
import { WyzeApiClient, isStreamableCamera } from "./wyze-api.js";

describe("isStreamableCamera", () => {
  it("accepts known live-stream model prefixes", () => {
    expect(isStreamableCamera("WYZEC3")).toBe(true);
    expect(isStreamableCamera("WYZEDB3")).toBe(true);
    expect(isStreamableCamera("Plug")).toBe(false);
  });
});

describe("WyzeApiClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns mock cameras when WYZE_MOCK=1", async () => {
    vi.stubEnv("WYZE_MOCK", "1");
    const client = new WyzeApiClient();
    const cameras = await client.listCameras({ keyId: "k", apiKey: "a" });
    expect(cameras).toHaveLength(1);
    expect(cameras[0]?.mac).toBe("AA:BB:CC:DD:EE:FF");
    expect(cameras[0]?.hasLiveStream).toBe(true);
  });

  it("filters the live API list to streamable cameras", async () => {
    vi.stubEnv("WYZE_MOCK", "0");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          code: "1",
          data: {
            device_list: [
              {
                mac: "AA:11",
                product_model: "WYZEC3",
                nickname: "Porch",
                conn_state: 1,
                product_type: "Camera",
              },
              {
                mac: "BB:22",
                product_model: "WLPP1",
                nickname: "Plug",
                conn_state: 1,
                product_type: "Plug",
              },
            ],
          },
        }),
      })),
    );

    const client = new WyzeApiClient();
    const cameras = await client.listCameras({ keyId: "k", apiKey: "a" });
    expect(cameras.map((c) => c.mac)).toEqual(["AA:11"]);
  });

  it("returns mock KVS signaling shape for getStreamInfo", async () => {
    vi.stubEnv("WYZE_MOCK", "1");
    const client = new WyzeApiClient();
    const info = await client.getStreamInfo("AA:BB:CC:DD:EE:FF", "WYZEC3", {
      keyId: "k",
      apiKey: "a",
    });
    expect(info.signalingUrl).toContain("wss://");
    expect(info.authToken).toBeTruthy();
    expect(info.iceServers.length).toBeGreaterThan(0);
  });
});
