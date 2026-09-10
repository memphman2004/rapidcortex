"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  TranslatePhrase,
  TranslateSession,
  TranslateSessionCreateRequest,
  TranslateSpeaker,
  TranslateVertical,
  TranslateWsOutbound,
} from "rapid-cortex-shared";
import {
  closeTranslateSession,
  createTranslateSession,
  getTranslateSession,
  getTranslateWsToken,
  joinTranslateMonitor,
} from "./translate-api";

export type FeedItem = {
  segmentId: string;
  speaker: TranslateSpeaker;
  originalText: string;
  translatedText?: string;
  originalLanguage: string;
  audioUrl?: string;
  isFinal: boolean;
};

function pcmFromFloat32(input: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

export function useTranslateSession(opts: {
  sessionId?: string;
  vertical: TranslateVertical;
  monitor?: boolean;
  createRequest?: TranslateSessionCreateRequest;
}) {
  const [session, setSession] = useState<TranslateSession | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speakerRef = useRef<TranslateSpeaker>("officer");

  const applyEvent = useCallback((evt: TranslateWsOutbound) => {
    if (evt.type === "error") {
      setError(evt.message);
      return;
    }
    if (evt.type === "transcript_partial" || evt.type === "transcript_final") {
      setFeed((prev) => {
        const next = prev.filter((p) => p.segmentId !== evt.segmentId);
        next.push({
          segmentId: evt.segmentId,
          speaker: evt.speaker,
          originalText: evt.originalText,
          originalLanguage: evt.originalLanguage,
          isFinal: evt.type === "transcript_final",
        });
        return next;
      });
      return;
    }
    if (evt.type === "translation_ready") {
      setFeed((prev) =>
        prev.map((p) =>
          p.segmentId === evt.segmentId ? { ...p, translatedText: evt.translatedText, isFinal: true } : p,
        ),
      );
      return;
    }
    if (evt.type === "audio_ready") {
      setFeed((prev) =>
        prev.map((p) => (p.segmentId === evt.segmentId ? { ...p, audioUrl: evt.audioPresignedUrl } : p)),
      );
      const audio = new Audio(evt.audioPresignedUrl);
      void audio.play().catch(() => undefined);
      return;
    }
    if (evt.type === "language_detected" && session) {
      setSession({ ...session, subjectLanguage: evt.languageCode, subjectLanguageDetected: true });
    }
    if (evt.type === "session_state") {
      setSession((cur) => (cur ? { ...cur, status: evt.status, segmentCount: evt.segmentCount } : cur));
    }
  }, [session]);

  const connectWs = useCallback(
    async (sessionId: string, monitor: boolean) => {
      const tok = monitor
        ? await joinTranslateMonitor(sessionId)
        : await getTranslateWsToken(sessionId, "officer");
      const ws = new WebSocket(tok.wsEndpoint);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onmessage = (ev) => {
        try {
          applyEvent(JSON.parse(String(ev.data)) as TranslateWsOutbound);
        } catch {
          // ignore
        }
      };
    },
    [applyEvent],
  );

  useEffect(() => {
    if (!opts.sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { session: loaded } = await getTranslateSession(opts.sessionId!);
        if (cancelled) return;
        setSession(loaded);
        await connectWs(loaded.sessionId, opts.monitor === true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load session");
      }
    })();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [opts.sessionId, opts.monitor, connectWs]);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const created = await createTranslateSession({
        vertical: opts.vertical,
        ...opts.createRequest,
      });
      setSession(created.session);
      await connectWs(created.session.sessionId, false);
      return created.session;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start session");
      return null;
    } finally {
      setStarting(false);
    }
  }, [connectWs, opts.createRequest, opts.vertical]);

  const sendPhrase = useCallback((phrase: TranslatePhrase, speaker: TranslateSpeaker = "officer") => {
    wsRef.current?.send(
      JSON.stringify({ type: "phrase", speaker, text: phrase.text, phraseId: phrase.id }),
    );
  }, []);

  const unlockAudio = useCallback(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx({ sampleRate: 16000 });
    void audioCtxRef.current.resume();
  }, []);

  const startMic = useCallback(
    async (speaker: TranslateSpeaker) => {
      speakerRef.current = speaker;
      unlockAudio();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
        streamRef.current = stream;
        const ctx = audioCtxRef.current ?? new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (ev) => {
          const input = ev.inputBuffer.getChannelData(0);
          const b64 = toBase64(pcmFromFloat32(input));
          wsRef.current?.send(
            JSON.stringify({
              type: "audio_chunk",
              speaker: speakerRef.current,
              audioBase64: b64,
              sampleRate: 16000,
              isFinal: false,
            }),
          );
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        setListening(true);
      } catch {
        setError("Microphone access failed");
      }
    },
    [unlockAudio],
  );

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (listening) {
      wsRef.current?.send(
        JSON.stringify({
          type: "audio_chunk",
          speaker: speakerRef.current,
          audioBase64: "",
          sampleRate: 16000,
          isFinal: true,
        }),
      );
    }
    setListening(false);
  }, [listening]);

  const close = useCallback(
    async (writeback = false) => {
      stopMic();
      if (!session) return;
      const res = await closeTranslateSession(session.sessionId, {
        writebackNote: writeback,
        cadWriteback: writeback,
      });
      setSession(res.session);
      wsRef.current?.close();
    },
    [session, stopMic],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
    return () => window.clearInterval(id);
  }, []);

  return {
    session,
    feed,
    error,
    connected,
    listening,
    starting,
    start,
    sendPhrase,
    startMic,
    stopMic,
    close,
    unlockAudio,
    setError,
  };
}
