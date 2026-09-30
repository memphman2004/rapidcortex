export type TranslateSpeaker = 'officer' | 'subject';

export type TranslateFeedItem = {
  segmentId: string;
  speaker: TranslateSpeaker;
  originalText: string;
  translatedText?: string;
  originalLanguage: string;
  audioUrl?: string;
  isFinal: boolean;
};

export type TranslateWsOutbound =
  | {
      type: 'transcript_partial' | 'transcript_final';
      segmentId: string;
      speaker: TranslateSpeaker;
      originalText: string;
      originalLanguage: string;
      confidence: number;
    }
  | {
      type: 'translation_ready';
      segmentId: string;
      speaker: TranslateSpeaker;
      translatedText: string;
      targetLanguage: string;
    }
  | {
      type: 'audio_ready';
      segmentId: string;
      speaker: TranslateSpeaker;
      audioPresignedUrl: string;
      durationMs: number;
    }
  | {
      type: 'language_detected';
      languageCode: string;
      languageLabel: string;
      confidence: number;
    }
  | {
      type: 'session_state';
      status: string;
      segmentCount: number;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    }
  | { type: 'pong' }
  | { type: 'monitor_joined' | 'monitor_left'; monitorUserName: string };

type WsHandlers = {
  onEvent: (evt: TranslateWsOutbound) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
};

export class TranslateWsClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: WsHandlers;

  constructor(handlers: WsHandlers) {
    this.handlers = handlers;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(wsEndpoint: string): void {
    this.close();
    const ws = new WebSocket(wsEndpoint);
    this.ws = ws;
    ws.onopen = () => {
      this.handlers.onOpen?.();
      this.pingTimer = setInterval(() => {
        this.send({ type: 'ping' });
      }, 25_000);
    };
    ws.onclose = () => {
      this.clearPing();
      this.handlers.onClose?.();
    };
    ws.onerror = () => {
      this.handlers.onError?.('Translate live connection failed');
    };
    ws.onmessage = (ev) => {
      try {
        const evt = JSON.parse(String(ev.data)) as TranslateWsOutbound;
        this.handlers.onEvent(evt);
      } catch {
        // ignore malformed
      }
    };
  }

  send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  sendPhrase(text: string, speaker: TranslateSpeaker, phraseId?: string): void {
    this.send({ type: 'phrase', speaker, text, phraseId });
  }

  sendAudioChunk(opts: {
    speaker: TranslateSpeaker;
    audioBase64: string;
    sampleRate?: number;
    isFinal: boolean;
  }): void {
    this.send({
      type: 'audio_chunk',
      speaker: opts.speaker,
      audioBase64: opts.audioBase64,
      sampleRate: opts.sampleRate ?? 16000,
      isFinal: opts.isFinal,
    });
  }

  close(): void {
    this.clearPing();
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

/** BCP-47 locale for on-device STT from translate subject language codes. */
export function sttLocaleForLanguage(code: string, speaker: TranslateSpeaker): string {
  if (speaker === 'officer') return 'en-US';
  const map: Record<string, string> = {
    es: 'es-US',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    vi: 'vi-VN',
    ko: 'ko-KR',
    ar: 'ar-SA',
    tl: 'fil-PH',
    ru: 'ru-RU',
    fr: 'fr-FR',
    de: 'de-DE',
    pt: 'pt-BR',
    hi: 'hi-IN',
    so: 'so-SO',
    am: 'am-ET',
    ht: 'ht-HT',
  };
  return map[code] ?? code;
}
