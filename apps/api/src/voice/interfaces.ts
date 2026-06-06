export type LanguageDetectionMethod =
  | "azure_translator"
  | "google_translate"
  | "comprehend"
  | "heuristic"
  | "client_hint"
  | "mock";

export type LanguageDetectionResult = {
  language: string;
  confidence: number;
  alternatives: { language: string; confidence: number }[];
  detectionMethod: LanguageDetectionMethod;
};

export interface ILanguageDetector {
  readonly name: string;
  detectFromText(
    text: string,
    options?: { signal?: AbortSignal },
  ): Promise<LanguageDetectionResult>;
}

export type SttChunkResult = {
  transcript: string;
  languageCode: string;
  confidence: number;
  isPartial: boolean;
  startTimeMs?: number;
  endTimeMs?: number;
  sttModelUsed?: string;
  /** Wall time spent inside this STT provider (e.g. Amazon Transcribe batch poll), when measured. */
  sttProviderLatencyMs?: number;
  /** Provider correlation id (e.g. Transcribe `TranscriptionJobName`). */
  providerRequestId?: string;
};

export interface ISpeechToTextProvider {
  readonly name: string;
  transcribeAudioChunk(
    input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
    options?: { signal?: AbortSignal },
  ): Promise<SttChunkResult>;
}

export type TranslationResult = {
  translated: string;
  confidence: number;
  sourceLanguage: string;
  targetLanguage: "en";
};

export interface ITranslationProvider {
  readonly name: string;
  translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: "en",
    options?: { signal?: AbortSignal; agencyId?: string },
  ): Promise<TranslationResult>;
}
