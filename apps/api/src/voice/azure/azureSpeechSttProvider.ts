import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import type { ISpeechToTextProvider, SttChunkResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { pcm16leMonoToWav, readWavSampleRateHeader } from "../audio/wavFromPcm16le.js";
import { toAzureSttLocale } from "../languageLocales.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

type AzureSttJson = {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: { Confidence?: number; Lexical?: string; Display?: string }[];
};

function prepareAudioPayload(audioBytes: Uint8Array, format: string): { body: Uint8Array; contentType: string } {
  if (format === "pcm16le") {
    return {
      body: pcm16leMonoToWav(audioBytes),
      contentType: "audio/wav; codecs=audio/pcm; samplerate=16000",
    };
  }
  if (format === "wav") {
    const sr = readWavSampleRateHeader(audioBytes) ?? 16000;
    return {
      body: audioBytes,
      contentType: `audio/wav; codecs=audio/pcm; samplerate=${sr}`,
    };
  }
  if (format === "webm") {
    return { body: audioBytes, contentType: "audio/webm" };
  }
  return {
    body: pcm16leMonoToWav(audioBytes),
    contentType: "audio/wav; codecs=audio/pcm; samplerate=16000",
  };
}

export class AzureSpeechToTextProvider implements ISpeechToTextProvider {
  readonly name: string;
  private keyMemo: Promise<string> | null = null;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string },
  ) {
    this.name = opts?.name ?? "azure-stt";
  }

  private async resolveKey(): Promise<string> {
    this.keyMemo ??= resolvePlainOrSecretArn(this.cfg.azureSpeechKey, this.cfg.azureSpeechKeySecretArn, {
      preferredField: "azureSpeechKey",
    });
    const key = await this.keyMemo;
    if (!key) {
      throw new VoiceProviderError("Azure Speech key missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
        retryable: false,
      });
    }
    return key;
  }

  async transcribeAudioChunk(
    input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
    options?: { signal?: AbortSignal },
  ): Promise<SttChunkResult> {
    const key = await this.resolveKey();
    const region = this.cfg.azureSpeechRegion.trim() || "eastus";
    const base =
      this.cfg.azureSpeechEndpoint.trim() ||
      `https://${region}.stt.speech.microsoft.com`;
    const locale = toAzureSttLocale(input.hintLanguage);
    const url = `${base.replace(/\/$/, "")}/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
    const { body, contentType } = prepareAudioPayload(input.audioBytes, input.format);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body: Buffer.from(body),
      signal: options?.signal,
    });

    if (!res.ok) {
      throw new VoiceProviderError(`Azure STT HTTP ${res.status}`, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
        httpStatus: res.status,
        retryable: res.status === 429 || res.status >= 500,
      });
    }

    const json = (await res.json()) as AzureSttJson;
    const status = json.RecognitionStatus ?? "";
    if (status !== "Success") {
      throw new VoiceProviderError(
        `Azure STT status ${status}`,
        status === "InitialSilenceTimeout" || status === "NoMatch"
          ? VOICE_ERROR_CODES.STT_INVALID_RESPONSE
          : VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
        { retryable: false },
      );
    }
    const best = json.NBest?.[0];
    const transcript = (best?.Display ?? best?.Lexical ?? json.DisplayText ?? "").trim();
    if (!transcript) {
      throw new VoiceProviderError("Azure STT empty transcript", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
        retryable: false,
      });
    }
    const confidence = typeof best?.Confidence === "number" ? best.Confidence : 0.75;
    return {
      transcript,
      languageCode: normalizeCallLanguageCode(locale),
      confidence,
      isPartial: false,
      sttModelUsed: this.cfg.sttModelPrimary,
    };
  }
}
