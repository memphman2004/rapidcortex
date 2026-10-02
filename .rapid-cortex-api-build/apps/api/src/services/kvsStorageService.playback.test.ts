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

  it("returns ready from exported MP4 when the Kinesis stream is gone", async () => {
    const r = await getPlaybackInfo({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      storageMode: "off",
      streamName: undefined,
      streamArn: undefined,
      recordingS3Key: "live-video/agency-a/inc-1/lvs-1.mp4",
      recordingDownloadUrl: "https://example.invalid/clip.mp4",
      recordingDownloadExpiresAt: new Date().toISOString(),
    });
    expect(r.status).toBe("ready");
    expect(r.recordingDownloadUrl).toBe("https://example.invalid/clip.mp4");
    expect(r.recordingS3Key).toBe("live-video/agency-a/inc-1/lvs-1.mp4");
  });
});
