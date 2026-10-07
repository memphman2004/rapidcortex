import { describe, it, expect } from "vitest";
import { getPlaybackInfo } from "./kvsStorageService.js";

describe("getPlaybackInfo", () => {
  it("returns not_available when storage mode is off", async () => {
    const r = await getPlaybackInfo({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      storageMode: "off",
      streamName: "x",
      streamArn: "arn",
    });
    expect(r.status).toBe("not_available");
    expect(r.storageMode).toBe("off");
  });

  it("returns not_available when no stream name", async () => {
    const r = await getPlaybackInfo({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      storageMode: "kvs-ingestion",
      streamName: undefined,
      streamArn: undefined,
    });
    expect(r.status).toBe("not_available");
  });
});
