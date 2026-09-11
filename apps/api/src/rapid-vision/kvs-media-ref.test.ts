import { describe, expect, it } from "vitest";
import { resolveVisionSessionKvsRef, visionWebRtcChannelName } from "./kvs-media-ref.js";

describe("resolveVisionSessionKvsRef", () => {
  it("prefers an explicit stream ARN for HLS", () => {
    expect(
      resolveVisionSessionKvsRef({
        kvsChannelName: "ring-channel-1",
        kvsStreamArn: "arn:aws:kinesisvideo:us-east-1:1:stream/cam/1",
      }),
    ).toEqual({
      kvsChannelName: "ring-channel-1",
      kvsStreamArn: "arn:aws:kinesisvideo:us-east-1:1:stream/cam/1",
    });
  });

  it("falls back to the signaling channel name when Ring has no media ARN", () => {
    expect(
      resolveVisionSessionKvsRef({
        kvsChannelName: "ring-channel-1",
        kvsStreamArn: null,
      }),
    ).toEqual({
      kvsChannelName: "ring-channel-1",
      kvsStreamArn: "ring-channel-1",
    });
  });

  it("leaves both null when the camera has no KVS reference", () => {
    expect(resolveVisionSessionKvsRef({ kvsChannelName: null, kvsStreamArn: null })).toEqual({
      kvsChannelName: null,
      kvsStreamArn: null,
    });
  });
});

describe("visionWebRtcChannelName", () => {
  it("prefers kvsChannelName for WebRTC signaling", () => {
    expect(
      visionWebRtcChannelName({
        kvsChannelName: "rc-connect-sess-1",
        kvsStreamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/media/1",
      }),
    ).toBe("rc-connect-sess-1");
  });

  it("falls back to a non-ARN kvsStreamArn", () => {
    expect(
      visionWebRtcChannelName({
        kvsChannelName: null,
        kvsStreamArn: "rc-connect-sess-1",
      }),
    ).toBe("rc-connect-sess-1");
  });

  it("parses a signaling channel ARN", () => {
    expect(
      visionWebRtcChannelName({
        kvsChannelName: "",
        kvsStreamArn: "arn:aws:kinesisvideo:us-east-1:123:channel/rc-connect-abc/1700000000",
      }),
    ).toBe("rc-connect-abc");
  });

  it("does not treat a media stream ARN as a signaling channel", () => {
    expect(
      visionWebRtcChannelName({
        kvsChannelName: null,
        kvsStreamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/media/1",
      }),
    ).toBe("");
  });
});
