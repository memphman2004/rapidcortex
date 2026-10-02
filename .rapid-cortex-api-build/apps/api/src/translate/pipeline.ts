import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import {
  findSupportedLanguage,
  OFFICER_LANGUAGE,
  type TranslateSegment,
  type TranslateSession,
  type TranslateSpeaker,
  type TranslateWsOutbound,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { translateStore } from "./store.js";

const s3 = new S3Client({ region: env.region });
const translateClient = new TranslateClient({ region: env.region });

const MOCK_OFFICER = "Please stay where you are. I am here to help you.";
const MOCK_SUBJECT = "No hablo ingles. Necesito ayuda.";

export type ProcessUtteranceInput = {
  session: TranslateSession;
  speaker: TranslateSpeaker;
  text?: string;
  phraseId?: string;
  audioBase64?: string;
  sampleRate?: number;
  isFinal: boolean;
};

function logPipeline(session: TranslateSession, payload: Record<string, unknown>): void {
  if (session.vertical === "hospital") {
    console.log(
      JSON.stringify({
        type: "translate.pipeline",
        sessionId: session.sessionId,
        agencyId: session.agencyId,
        vertical: session.vertical,
        speaker: payload.speaker,
      }),
    );
    return;
  }
  console.log(JSON.stringify({ type: "translate.pipeline", sessionId: session.sessionId, ...payload }));
}

function sourceLang(session: TranslateSession, speaker: TranslateSpeaker): string {
  if (speaker === "officer") return OFFICER_LANGUAGE.translateCode;
  return findSupportedLanguage(session.subjectLanguage)?.translateCode || session.subjectLanguage || "es";
}

function targetLang(session: TranslateSession, speaker: TranslateSpeaker): string {
  if (speaker === "officer") {
    return findSupportedLanguage(session.subjectLanguage)?.translateCode || session.subjectLanguage || "es";
  }
  return OFFICER_LANGUAGE.translateCode;
}

function sourceDisplay(session: TranslateSession, speaker: TranslateSpeaker): string {
  return speaker === "officer" ? OFFICER_LANGUAGE.code : session.subjectLanguage || "es";
}

function targetDisplay(session: TranslateSession, speaker: TranslateSpeaker): string {
  return speaker === "officer" ? session.subjectLanguage || "es" : OFFICER_LANGUAGE.code;
}

async function transcribeAudio(
  session: TranslateSession,
  speaker: TranslateSpeaker,
  audioBase64: string,
): Promise<{ text: string; confidence: number; detected?: string }> {
  if (env.translateMock) {
    return {
      text: speaker === "officer" ? MOCK_OFFICER : MOCK_SUBJECT,
      confidence: 0.94,
      detected: speaker === "subject" && !session.subjectLanguageDetected ? "es" : undefined,
    };
  }

  const pcm = Buffer.from(audioBase64, "base64");
  if (pcm.length < 320) {
    return { text: "", confidence: 0 };
  }

  try {
    const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = await import(
      "@aws-sdk/client-transcribe-streaming"
    );
    const lang =
      speaker === "officer"
        ? OFFICER_LANGUAGE.transcribeCode
        : findSupportedLanguage(session.subjectLanguage)?.transcribeCode || "es-US";
    const client = new TranscribeStreamingClient({ region: env.region });
    async function* audioStream() {
      yield { AudioEvent: { AudioChunk: pcm } };
    }
    const out = await client.send(
      new StartStreamTranscriptionCommand({
        LanguageCode: lang as import("@aws-sdk/client-transcribe-streaming").LanguageCode,
        MediaEncoding: "pcm",
        MediaSampleRateHertz: 16000,
        AudioStream: audioStream(),
      }),
    );
    let text = "";
    let confidence = 0.8;
    if (out.TranscriptResultStream) {
      for await (const event of out.TranscriptResultStream) {
        const results = event.TranscriptEvent?.Transcript?.Results ?? [];
        for (const result of results) {
          if (result.IsPartial) continue;
          const alt = result.Alternatives?.[0];
          if (alt?.Transcript) {
            text = alt.Transcript;
            confidence = alt.Items?.[0]?.Confidence ?? 0.85;
          }
        }
      }
    }
    return { text, confidence };
  } catch (error) {
    logPipeline(session, {
      speaker,
      step: "transcribe_error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("TRANSCRIBE_ERROR");
  }
}

async function translateText(
  session: TranslateSession,
  text: string,
  source: string,
  target: string,
): Promise<string> {
  if (source === target) return text;
  if (env.translateMock) {
    if (target === "en") return `[EN] ${text}`;
    return `[${target.toUpperCase()}] ${text}`;
  }
  const res = await translateClient.send(
    new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: source === "zh-TW" ? "zh" : source,
      TargetLanguageCode: target === "zh-TW" ? "zh-TW" : target,
    }),
  );
  return res.TranslatedText?.trim() || text;
}

async function synthesizeAndStore(
  session: TranslateSession,
  segmentId: string,
  text: string,
  langCode: string,
): Promise<{ key?: string; url?: string; durationMs: number }> {
  const durationMs = Math.min(12000, Math.max(800, text.length * 60));
  const lang = findSupportedLanguage(langCode) ?? (langCode === "en" ? OFFICER_LANGUAGE : undefined);
  const prefix = session.vertical === "hospital" ? "audio/hospital" : "audio/standard";
  const key = `${prefix}/${session.agencyId}/${session.sessionId}/${segmentId}.mp3`;

  if (env.translateMock || !env.translateAudioBucket) {
    return { durationMs };
  }

  try {
    const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
    const polly = new PollyClient({ region: env.region });
    const voice = lang ?? OFFICER_LANGUAGE;
    const speech = await polly.send(
      new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: "mp3",
        VoiceId: voice.pollyVoiceId as import("@aws-sdk/client-polly").VoiceId,
        Engine: voice.pollyEngine,
        LanguageCode: voice.transcribeCode as import("@aws-sdk/client-polly").LanguageCode,
      }),
    );
    const bytes = speech.AudioStream
      ? Buffer.from(await speech.AudioStream.transformToByteArray())
      : Buffer.alloc(0);
    if (!bytes.length) return { durationMs };

    await s3.send(
      new PutObjectCommand({
        Bucket: env.translateAudioBucket,
        Key: key,
        Body: bytes,
        ContentType: "audio/mpeg",
        Tagging:
          session.vertical === "hospital"
            ? "vertical=hospital&retention=cms7y"
            : `vertical=${session.vertical}`,
      }),
    );
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: env.translateAudioBucket, Key: key }),
      { expiresIn: 60 },
    );
    return { key, url, durationMs };
  } catch (error) {
    logPipeline(session, {
      step: "polly_error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("POLLY_ERROR");
  }
}

export async function processUtterance(
  input: ProcessUtteranceInput,
): Promise<{ session: TranslateSession; events: TranslateWsOutbound[]; segment?: TranslateSegment }> {
  const { speaker, isFinal } = input;
  const events: TranslateWsOutbound[] = [];
  let session = input.session;

  if (session.status === "CLOSED" || session.status === "EXPIRED") {
    events.push({ type: "error", code: "SESSION_CLOSED", message: "Session is closed" });
    return { session, events };
  }

  let originalText = (input.text ?? "").trim();
  let confidence = 1;
  let detected: string | undefined;

  if (!originalText && input.audioBase64) {
    try {
      const stt = await transcribeAudio(session, speaker, input.audioBase64);
      originalText = stt.text.trim();
      confidence = stt.confidence;
      detected = stt.detected;
    } catch {
      events.push({
        type: "error",
        code: "TRANSCRIBE_ERROR",
        message: "Speech recognition failed",
      });
      return { session, events };
    }
  }

  if (!originalText) {
    return { session, events };
  }

  if (confidence < 0.45) {
    events.push({
      type: "error",
      code: "LOW_CONFIDENCE",
      message: "Could not understand the last utterance. Please repeat.",
    });
    return { session, events };
  }

  if (detected && speaker === "subject" && !session.subjectLanguageDetected) {
    const lang = findSupportedLanguage(detected);
    if (lang) {
      session = {
        ...session,
        subjectLanguage: lang.code,
        subjectLanguageDetected: true,
        updatedAt: new Date().toISOString(),
      };
      await translateStore.putSession(session);
      events.push({
        type: "language_detected",
        languageCode: lang.code,
        languageLabel: lang.label,
        confidence,
      });
    }
  }

  const segmentId = makeId("tseg");
  const originalLanguage = sourceDisplay(session, speaker);
  const targetLanguage = targetDisplay(session, speaker);

  events.push({
    type: isFinal ? "transcript_final" : "transcript_partial",
    segmentId,
    speaker,
    originalText,
    originalLanguage,
    confidence,
  });

  if (!isFinal) {
    return { session, events };
  }

  let translatedText: string;
  try {
    translatedText = await translateText(
      session,
      originalText,
      sourceLang(session, speaker),
      targetLang(session, speaker),
    );
  } catch (error) {
    logPipeline(session, {
      speaker,
      step: "translate_error",
      error: error instanceof Error ? error.message : String(error),
    });
    events.push({ type: "error", code: "TRANSLATE_ERROR", message: "Translation failed" });
    return { session, events };
  }

  events.push({
    type: "translation_ready",
    segmentId,
    speaker,
    translatedText,
    targetLanguage,
  });

  let audio: { key?: string; url?: string; durationMs: number } = { durationMs: 1000 };
  try {
    audio = await synthesizeAndStore(session, segmentId, translatedText, targetLanguage);
    if (audio.url) {
      events.push({
        type: "audio_ready",
        segmentId,
        speaker,
        audioPresignedUrl: audio.url,
        durationMs: audio.durationMs,
      });
    }
  } catch {
    events.push({ type: "error", code: "POLLY_ERROR", message: "Voice playback failed" });
  }

  const now = new Date().toISOString();
  const segment: TranslateSegment = {
    segmentId,
    sessionId: session.sessionId,
    agencyId: session.agencyId,
    speaker,
    originalText,
    translatedText,
    originalLanguage,
    targetLanguage,
    confidenceScore: confidence,
    audioS3Key: audio.key,
    durationMs: audio.durationMs,
    timestamp: now,
    isFinal: true,
    phraseId: input.phraseId,
  };

  await translateStore.putSegment(segment);
  await translateStore.incrementSegmentCount(session.agencyId, session.sessionId);
  session = {
    ...session,
    segmentCount: session.segmentCount + 1,
    updatedAt: now,
  };
  events.push({ type: "session_state", status: session.status, segmentCount: session.segmentCount });
  return { session, events, segment };
}
