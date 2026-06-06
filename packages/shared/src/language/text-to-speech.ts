/**
 * Normalized TTS result for server-side providers (Google, future AWS Polly, etc.).
 */
export type TextToSpeechAudioEncoding = "MP3" | "OGG_OPUS" | "LINEAR16" | "MULAW" | "ALAW";

export type SynthesizedUtterance = {
  /** Raw audio bytes (e.g. MP3 or LINEAR16 PCM). */
  audioContent: Uint8Array;
  mimeType: string;
  /** Provider-specific voice identifier (e.g. `en-US-Neural2-D`). */
  voiceName: string;
  /** BCP-47 or provider language (e.g. `en-US`). */
  languageCode: string;
  /** Milliseconds, when known. */
  audioDurationMs?: number;
  /** Optional S3 key when audio is written to a private bucket. */
  storageObjectKey?: string;
  encoding: TextToSpeechAudioEncoding;
};

export type SynthesizeTextRequest = {
  text: string;
  /** BCP-47 or provider language. */
  languageBcp: string;
  /**
   * Optional voice preference. Google uses names like `en-US-Neural2-C`.
   * If omitted, the provider picks a default by language and gender.
   */
  voiceName?: string;
  /**
   * Hint for default voice family when `voiceName` is omitted.
   * SSML is not used in v1.
   */
  preferredGender?: "FEMALE" | "MALE" | "NEUTRAL";
  audioEncoding?: TextToSpeechAudioEncoding;
  speakingRate?: number;
};
