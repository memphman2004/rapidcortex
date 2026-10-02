import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendKv, sendArchived, sendS3, sendLambda, getSignedUrlMock } = vi.hoisted(() => ({
  sendKv: vi.fn(),
  sendArchived: vi.fn(),
  sendS3: vi.fn(),
  sendLambda: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-kinesis-video", () => ({
  KinesisVideoClient: class {
    send = sendKv;
  },
  CreateStreamCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteStreamCommand: class {
    constructor(public input: unknown) {}
  },
  DescribeMediaStorageConfigurationCommand: class {
    constructor(public input: unknown) {}
  },
  GetDataEndpointCommand: class {
    constructor(public input: unknown) {}
  },
  UpdateMediaStorageConfigurationCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/client-kinesis-video-archived-media", () => ({
  KinesisVideoArchivedMediaClient: class {
    send = sendArchived;
  },
  GetClipCommand: class {
    constructor(public input: unknown) {}
  },
  GetHLSStreamingSessionURLCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendS3;
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class {
    send = sendLambda;
  },
  InvokeCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...a: unknown[]) => getSignedUrlMock(...a),
}));

import {
  enqueueRecordingExport,
  exportSessionClipToS3,
  liveVideoRecordingObjectKey,
} from "./kvsStorageService.js";

describe("live video recording export", () => {
  beforeEach(() => {
    sendKv.mockReset();
    sendArchived.mockReset();
    sendS3.mockReset();
    sendLambda.mockReset();
    getSignedUrlMock.mockReset();
    process.env.ASSETS_BUCKET = "test-assets-bucket";
    process.env.LIVE_VIDEO_EXPORT_FUNCTION_NAME = "";
  });

  it("scopes the object key by agencyId", () => {
    expect(liveVideoRecordingObjectKey("agency-a", "inc-1", "lvs-1")).toBe("live-video/agency-a/inc-1/lvs-1.mp4");
  });

  it("writes GetClip bytes to the agency-scoped S3 key", async () => {
    sendKv.mockResolvedValue({ DataEndpoint: "https://kvs.example.invalid" });
    sendArchived.mockResolvedValue({
      ContentType: "video/mp4",
      Payload: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    sendS3.mockResolvedValue({});
    const out = await exportSessionClipToS3({
      agencyId: "agency-a",
      incidentId: "inc-1",
      sessionId: "lvs-1",
      streamName: "rc-lvsv-lvs-1",
      startIso: new Date(Date.now() - 5_000).toISOString(),
      endIso: new Date().toISOString(),
    });
    expect(out).toEqual({ ok: true, key: "live-video/agency-a/inc-1/lvs-1.mp4" });
    expect(sendS3).toHaveBeenCalled();
  });

  it("returns NO_FRAGMENTS when KVS has no clip yet", async () => {
    sendKv.mockResolvedValue({ DataEndpoint: "https://kvs.example.invalid" });
    sendArchived.mockRejectedValue({ name: "ResourceNotFoundException", message: "No fragments found" });
    const out = await exportSessionClipToS3({
      agencyId: "agency-a",
      incidentId: "inc-1",
      sessionId: "lvs-1",
      streamName: "rc-lvsv-lvs-1",
      startIso: new Date(Date.now() - 5_000).toISOString(),
      endIso: new Date().toISOString(),
    });
    expect(out).toEqual({ ok: false, errorCode: "NO_FRAGMENTS" });
  });

  it("does not invoke Lambda when the export function name is unset", async () => {
    await enqueueRecordingExport("lvs-1");
    expect(sendLambda).not.toHaveBeenCalled();
  });
});
