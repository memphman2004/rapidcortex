import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env.js";
import {
  assertVideoAssistIceReady,
  isCustomIceConfigured,
  requiresVideoAssistTurn,
  resolveWebRtcIceServers,
} from "./webrtcIceServers.js";

describe("resolveWebRtcIceServers", () => {
  const prevIce = process.env.WEBRTC_ICE_SERVERS_JSON;
  const prevAssist = process.env.VIDEO_ASSIST_ICE_SERVERS_JSON;
  const prevTurnArn = env.webrtcTurnSecretArn;
  const prevStage = process.env.DEPLOYMENT_STAGE;
  const prevAllowStun = process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY;

  afterEach(() => {
    if (prevIce === undefined) delete process.env.WEBRTC_ICE_SERVERS_JSON;
    else process.env.WEBRTC_ICE_SERVERS_JSON = prevIce;
    if (prevAssist === undefined) delete process.env.VIDEO_ASSIST_ICE_SERVERS_JSON;
    else process.env.VIDEO_ASSIST_ICE_SERVERS_JSON = prevAssist;
    env.webrtcTurnSecretArn = prevTurnArn;
    if (prevStage === undefined) delete process.env.DEPLOYMENT_STAGE;
    else process.env.DEPLOYMENT_STAGE = prevStage;
    if (prevAllowStun === undefined) delete process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY;
    else process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY = prevAllowStun;
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

  it("requires TURN on live/prod-like stages unless ICE is configured", () => {
    delete process.env.WEBRTC_ICE_SERVERS_JSON;
    delete process.env.VIDEO_ASSIST_ICE_SERVERS_JSON;
    delete process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY;
    env.webrtcTurnSecretArn = "";
    process.env.DEPLOYMENT_STAGE = "dev";
    expect(requiresVideoAssistTurn()).toBe(true);
    expect(() => assertVideoAssistIceReady()).toThrow("VIDEO_ASSIST_TURN_REQUIRED");

    process.env.WEBRTC_ICE_SERVERS_JSON = JSON.stringify([{ urls: "turn:t.example:3478" }]);
    expect(() => assertVideoAssistIceReady()).not.toThrow();
  });

  it("allows STUN-only when VIDEO_ASSIST_ALLOW_STUN_ONLY is set", () => {
    delete process.env.WEBRTC_ICE_SERVERS_JSON;
    env.webrtcTurnSecretArn = "";
    process.env.DEPLOYMENT_STAGE = "staging";
    process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY = "1";
    expect(requiresVideoAssistTurn()).toBe(false);
    expect(() => assertVideoAssistIceReady()).not.toThrow();
  });
});
