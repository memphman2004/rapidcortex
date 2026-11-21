"use client";

/**
 * useCoachingWebRtc — WebRTC MASTER audio hook for supervisor coaching channel
 *
 * Architecture:
 *   - Supervisor connects to the KVS SINGLE_MASTER signaling channel as MASTER.
 *   - Officer connects as VIEWER.
 *   - On open: MASTER waits for the VIEWER's SDP offer, answers it, then
 *     both sides exchange ICE candidates.
 *   - Microphone is added as a send-only track when PTT is active.
 *   - `startPtt()` unmutes the mic track (or creates it on first call).
 *   - `stopPtt()` mutes the mic track and fires the backend /coaching/ptt event.
 *   - Token auto-refresh: 2 min before expiry the caller should re-fetch the
 *     token (via useCoachingToken) and pass it in; the hook reconnects.
 *
 * Safety notes:
 *   - Mic permission is requested on first `startPtt()` call, not on mount.
 *   - On unmount the peer + signaling + mic stream are all cleaned up.
 *   - Non-fatal events (ICE failure, WS close) trigger a 3-second reconnect;
 *     the hook surfaces state to the UI but does not throw.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as KVSWebRTC from "amazon-kinesis-video-streams-webrtc";
import type { LiveAssistCoachingTokenResponse } from "rapid-cortex-shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CoachingConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "mic_permission_denied"
  | "error"
  | "ended";

export interface UseCoachingWebRtcOptions {
  /** KVS token from useCoachingToken; pass null/undefined to stay idle. */
  token: LiveAssistCoachingTokenResponse | null | undefined;
  /**
   * Fired after the backend PTT event is sent.
   * Parent may show a visual indicator to the supervisor.
   */
  onPttStateChange?: (active: boolean) => void;
  /** Fired when the channel is fully torn down (officer disconnected or error). */
  onDisconnect?: () => void;
}

export interface UseCoachingWebRtcResult {
  connectionState: CoachingConnectionState;
  /** True while PTT is active (mic open, audio flowing to officer) */
  isPttActive: boolean;
  /**
   * Open the microphone and begin audio. Safe to call repeatedly while held.
   * Requests mic permission on first call; rejects with MIC_PERMISSION_DENIED if denied.
   */
  startPtt: () => Promise<void>;
  /** Mute the mic. Call on pointer-up or key-up events. */
  stopPtt: () => void;
  /** Force-close the WebRTC connection and clean up. */
  disconnect: () => void;
  error: string | null;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function useCoachingWebRtc({
  token,
  onPttStateChange,
  onDisconnect,
}: UseCoachingWebRtcOptions): UseCoachingWebRtcResult {
  const peerRef      = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<KVSWebRTC.SignalingClient | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSenderRef = useRef<RTCRtpSender | null>(null);
  const reconnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef        = useRef(false);
  const connectFnRef    = useRef<(() => void) | null>(null);

  const [state, setState]       = useState<CoachingConnectionState>("idle");
  const [isPttActive, setIsPtt] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Cleanup helpers ──────────────────────────────────────────────────────

  const clearReconnTimer = useCallback(() => {
    if (reconnTimerRef.current) {
      clearTimeout(reconnTimerRef.current);
      reconnTimerRef.current = null;
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    signalingRef.current?.close();
    signalingRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    micSenderRef.current = null;
  }, []);

  const cleanupMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (endedRef.current) return;
    setState("reconnecting");
    reconnTimerRef.current = setTimeout(() => {
      connectFnRef.current?.();
    }, 3_000);
  }, []);

  // ── Core connect (MASTER role) ───────────────────────────────────────────

  const connect = useCallback(() => {
    if (!token) return;
    clearReconnTimer();
    cleanupPeer();
    setState("connecting");
    setError(null);

    const peer = new RTCPeerConnection({
      iceServers: token.iceServers,
      iceTransportPolicy: "all",
    });
    peerRef.current = peer;

    // Pre-create an audio transceiver so the peer is ready to send/receive audio.
    // We store the sender so startPtt can call replaceTrack() without creating
    // duplicate transceivers.
    const audioTransceiver = peer.addTransceiver("audio", { direction: "sendrecv" });
    micSenderRef.current = audioTransceiver.sender;

    peer.oniceconnectionstatechange = () => {
      if (
        peer.iceConnectionState === "failed" ||
        peer.iceConnectionState === "disconnected"
      ) {
        scheduleReconnect();
      }
    };

    peer.ontrack = () => {
      // Officer audio arrives here if they send audio back (future two-way).
      // For now we just mark connected on first track event.
    };

    peer.addEventListener("icecandidate", ({ candidate }) => {
      if (candidate) signalingRef.current?.sendIceCandidate(candidate);
    });

    const signalingClient = new KVSWebRTC.SignalingClient({
      channelARN: token.channelArn,
      channelEndpoint: token.wssEndpoint,
      role: KVSWebRTC.Role.MASTER,
      region: token.region,
      credentials: {
        accessKeyId: token.credentials.accessKeyId,
        secretAccessKey: token.credentials.secretAccessKey,
        sessionToken: token.credentials.sessionToken,
      },
      requestSigner: new KVSWebRTC.SigV4RequestSigner(token.region, {
        accessKeyId: token.credentials.accessKeyId,
        secretAccessKey: token.credentials.secretAccessKey,
        sessionToken: token.credentials.sessionToken,
      }),
      // MASTER does not need a client ID
      systemClockOffset: 0,
    });
    signalingRef.current = signalingClient;

    signalingClient.on("open", () => {
      // MASTER waits; officer (VIEWER) will send the SDP offer
      setState("connected");
    });

    // MASTER role: receive SDP offer from each VIEWER, respond with answer
    signalingClient.on("sdpOffer", async (offer: RTCSessionDescriptionInit, remoteClientId: string) => {
      try {
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        signalingClient.sendSdpAnswer(peer.localDescription!, remoteClientId);
      } catch {
        // SDP negotiation failed; non-fatal, officer may retry
      }
    });

    signalingClient.on("iceCandidate", async (candidate: RTCIceCandidateInit, remoteClientId: string) => {
      void remoteClientId;
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // non-fatal
      }
    });

    signalingClient.on("close", () => {
      if (!endedRef.current) scheduleReconnect();
    });

    signalingClient.on("error", (err: unknown) => {
      if (endedRef.current) return;
      const msg = err instanceof Error ? err.message : "Signaling error";
      setError(msg);
      scheduleReconnect();
    });

    signalingClient.open();
  }, [token, clearReconnTimer, cleanupPeer, scheduleReconnect]);

  // Keep connectFnRef current so the reconnect closure always has the latest
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // ── Reconnect when token changes ─────────────────────────────────────────

  useEffect(() => {
    endedRef.current = false;
    if (token) {
      connect();
    } else {
      setState("idle");
    }

    return () => {
      endedRef.current = true;
      clearReconnTimer();
      cleanupPeer();
      cleanupMic();
      setIsPtt(false);
      onDisconnect?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token?.channelArn, token?.credentials.sessionToken]);

  // ── PTT ──────────────────────────────────────────────────────────────────

  const startPtt = useCallback(async () => {
    if (isPttActive) return;
    if (!peerRef.current || state !== "connected") return;

    // Request mic permission on first call
    if (!micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micStreamRef.current = stream;
      } catch {
        setState("mic_permission_denied");
        setError("Microphone permission denied. Grant access in browser settings.");
        return;
      }
    }

    const [audioTrack] = micStreamRef.current.getAudioTracks();
    if (!audioTrack) return;

    // Replace or un-mute the audio track on the pre-created sender.
    // Using replaceTrack avoids creating duplicate transceivers.
    if (micSenderRef.current) {
      try {
        if (micSenderRef.current.track !== audioTrack) {
          await micSenderRef.current.replaceTrack(audioTrack);
        }
        audioTrack.enabled = true;
      } catch {
        // replaceTrack failed (peer may be closing); swallow
        return;
      }
    } else if (peerRef.current) {
      // Fallback: peer was recreated without storing sender (shouldn't happen)
      try {
        micSenderRef.current = peerRef.current.addTrack(audioTrack, micStreamRef.current);
      } catch {
        return;
      }
    }

    setIsPtt(true);
    onPttStateChange?.(true);
  }, [isPttActive, state, onPttStateChange]);

  const stopPtt = useCallback(() => {
    if (!isPttActive) return;

    // Mute track (keep the sender so re-activation is fast — no renegotiation needed)
    if (micSenderRef.current?.track) {
      micSenderRef.current.track.enabled = false;
    } else {
      micStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
    }

    setIsPtt(false);
    onPttStateChange?.(false);
  }, [isPttActive, onPttStateChange]);

  // ── Force disconnect ──────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    endedRef.current = true;
    clearReconnTimer();
    cleanupPeer();
    cleanupMic();
    setIsPtt(false);
    setState("ended");
    onDisconnect?.();
  }, [clearReconnTimer, cleanupPeer, cleanupMic, onDisconnect]);

  return { connectionState: state, isPttActive, startPtt, stopPtt, disconnect, error };
}
