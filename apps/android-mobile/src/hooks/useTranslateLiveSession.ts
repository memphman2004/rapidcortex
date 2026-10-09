import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  closeTranslateSession,
  createTranslateSession,
  getTranslateWsToken,
  type TranslateSession,
  type TranslateSessionCreateBody,
} from '@/services/api/translate';
import { playTranslateTts, stopTranslateTts } from '@/services/translate/tts-player';
import {
  sttLocaleForLanguage,
  TranslateWsClient,
  type TranslateFeedItem,
  type TranslateSpeaker,
  type TranslateWsOutbound,
} from '@/services/translate/ws-client';

function formatTranslateStartError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; family?: string; message?: string }
      | string
      | undefined;
    const body = typeof data === 'object' && data ? data : undefined;
    if (body?.error === 'addon_not_enabled') {
      return 'Translator is not enabled for this agency. Ask your admin to enable RC Translate.';
    }
    if (error.response?.status === 403) {
      return body?.message || body?.error || 'Not allowed to start a translation session for this role.';
    }
    if (error.response?.status === 401) {
      return 'Session expired — sign in again.';
    }
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (body?.message) return body.message;
    if (error.message) return error.message;
  }
  return error instanceof Error ? error.message : 'Failed to start session';
}

export function useTranslateLiveSession() {
  const [session, setSession] = useState<TranslateSession | null>(null);
  const [feed, setFeed] = useState<TranslateFeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [speaker, setSpeaker] = useState<TranslateSpeaker>('officer');
  const wsRef = useRef<TranslateWsClient | null>(null);
  const speakerRef = useRef<TranslateSpeaker>('officer');
  const subjectLangRef = useRef('es');

  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  const applyEvent = useCallback((evt: TranslateWsOutbound) => {
    if (evt.type === 'error') {
      setError(evt.message);
      return;
    }
    if (evt.type === 'transcript_partial' || evt.type === 'transcript_final') {
      setFeed((prev) => {
        const next = prev.filter((p) => p.segmentId !== evt.segmentId);
        next.push({
          segmentId: evt.segmentId,
          speaker: evt.speaker,
          originalText: evt.originalText,
          originalLanguage: evt.originalLanguage,
          isFinal: evt.type === 'transcript_final',
        });
        return next;
      });
      return;
    }
    if (evt.type === 'translation_ready') {
      setFeed((prev) =>
        prev.map((p) =>
          p.segmentId === evt.segmentId
            ? { ...p, translatedText: evt.translatedText, isFinal: true }
            : p,
        ),
      );
      return;
    }
    if (evt.type === 'audio_ready') {
      setFeed((prev) =>
        prev.map((p) =>
          p.segmentId === evt.segmentId ? { ...p, audioUrl: evt.audioPresignedUrl } : p,
        ),
      );
      void playTranslateTts(evt.audioPresignedUrl);
      return;
    }
    if (evt.type === 'language_detected') {
      subjectLangRef.current = evt.languageCode;
      setSession((cur) =>
        cur
          ? {
              ...cur,
              subjectLanguage: evt.languageCode,
            }
          : cur,
      );
      return;
    }
    if (evt.type === 'session_state') {
      setSession((cur) =>
        cur ? { ...cur, status: evt.status, segmentCount: evt.segmentCount } : cur,
      );
    }
  }, []);

  const connectWs = useCallback(
    async (sessionId: string) => {
      const tok = await getTranslateWsToken(sessionId, 'officer');
      const client = new TranslateWsClient({
        onEvent: applyEvent,
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
        onError: (message) => setError(message),
      });
      wsRef.current?.close();
      wsRef.current = client;
      client.connect(tok.wsEndpoint);
    },
    [applyEvent],
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      void stopTranslateTts();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    if (!event.isFinal) return;
    wsRef.current?.sendPhrase(transcript, speakerRef.current);
    setListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    setError(event.message || `Speech recognition error: ${event.error}`);
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
  });

  const start = useCallback(
    async (body: TranslateSessionCreateBody) => {
      setStarting(true);
      setError(null);
      setFeed([]);
      try {
        subjectLangRef.current = body.subjectLanguage || 'es';
        const created = await createTranslateSession(body);
        setSession(created.session);
        if (created.wsEndpoint) {
          const client = new TranslateWsClient({
            onEvent: applyEvent,
            onOpen: () => setConnected(true),
            onClose: () => setConnected(false),
            onError: (message) => setError(message),
          });
          wsRef.current?.close();
          wsRef.current = client;
          client.connect(created.wsEndpoint);
        } else {
          await connectWs(created.session.sessionId);
        }
        return created.session;
      } catch (e) {
        setError(formatTranslateStartError(e));
        return null;
      } finally {
        setStarting(false);
      }
    },
    [applyEvent, connectWs],
  );

  const startMic = useCallback(async (nextSpeaker: TranslateSpeaker) => {
    setError(null);
    setSpeaker(nextSpeaker);
    speakerRef.current = nextSpeaker;
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone / speech permission is required for translation');
        return;
      }
      const lang = sttLocaleForLanguage(subjectLangRef.current, nextSpeaker);
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
      setListening(true);
    } catch (e) {
      setListening(false);
      setError(e instanceof Error ? e.message : 'Could not start speech recognition');
    }
  }, []);

  const stopMic = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  const close = useCallback(async (writebackNote = false) => {
    stopMic();
    await stopTranslateTts();
    if (!session) return;
    try {
      const res = await closeTranslateSession(session.sessionId, { writebackNote });
      setSession(res.session);
      wsRef.current?.close();
      setConnected(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not end session');
    }
  }, [session, stopMic]);

  return {
    session,
    feed,
    error,
    connected,
    listening,
    starting,
    speaker,
    setSpeaker,
    start,
    startMic,
    stopMic,
    close,
    setError,
  };
}
