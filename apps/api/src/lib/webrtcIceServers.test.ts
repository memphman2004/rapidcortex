import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env.js";
import { isCustomIceConfigured, resolveWebRtcIceServers } from "./webrtcIceServers.js";

describe("resolveWebRtcIceServers", () => {
  const prevIce = process.env.WEBRTC_ICE_SERVERS_JSON;
  const prevAssist = process.env.VIDEO_ASSIST_ICE_SERVERS_JSON;
  const prevTurnArn = env.webrtcTurnSecretArn;

  afterEach(() => {
    if (prevIce === undefined) delete process.env.WEBRTC_ICE_SERVERS_JSON;
    else process.env.WEBRTC_ICE_SERVERS_JSON = prevIce;
    if (prevAssist === undefined) delete process.env.VIDEO_ASSIST_ICE_SERVERS_JSON;
    else process.env.VIDEO_ASSIST_ICE_SERVERS_JSON = prevAssist;
    env.webrtcTurnSecretArn = prevTurnArn;
  });

  it("falls back to Google STUN when nothing is configured", async () => {
    delete process.env.WEBRTC_ICE_SERVERS_JSON;
    delete process.env.VIDEO_ASSIST_ICE_SERVERS_JSON;
    env.webrtcTurnSecretArn = "";
    const servers = await resolveWebRtcIceServers();
    expect(servers).toEqual([{ urls: "stun:stun.l.google.com:19302" }]);
    expect(isCustomIceConfigured()).toBe(false);
  });

  it("prefers WEBRTC_ICE_SERVERS_JSON over STUN fallback", async () => {
    process.env.WEBRTC_ICE_SERVERS_JSON = JSON.stringify({
      iceServers: [{ urls: "turn:turn.example:3478", username: "u", credential: "p" }],
    });
    env.webrtcTurnSecretArn = "";
    const servers = await resolveWebRtcIceServers();
    expect(servers).toEqual([
      { urls: "turn:turn.example:3478", username: "u", credential: "p" },
    ]);
    expect(isCustomIceConfigured()).toBe(true);
  });
});
