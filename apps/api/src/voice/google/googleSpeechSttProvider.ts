import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import type { ISpeechToTextProvider, SttChunkResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { pcm16leMonoToWav, readWavSampleRateHeader } from "../audio/wavFromPcm16le.js";
import { googleAlternativeLanguageCodes, toGoogleSttLanguageCode } from "../languageLocales.js";
import {
  resolveGoogleServiceAccountCredentials,
  type GoogleServiceAccountCredentials,
} from "./googleCredentials.js";
import { getGoogleAccessToken } from "./googleAccessToken.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

type RecognizeResponse = {
  results?: {
    alternatives?: { transcript?: string; confidence?: number }[];
    languageCode?: string;
  }[];
};

function toAudioContentAndConfig(input: {
  audioBytes: Uint8Array;
  format: string;
  hintLanguage?: string;
}): { contentB64: string; encoding: string; sampleRateHertz: number; languageCode: string; alternatives: string[] } {
  const primary = toGoogleSttLanguageCode(input.hintLanguage);
  const alternatives = googleAlternativeLanguageCodes(input.hintLanguage ?? "und");
  if (input.format === "webm") {
    return {
      contentB64: Buffer.from(input.audioBytes).toString("base64"),
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: primary,
      alternatives,
    };
  }
  let pcm = input.audioBytes;
  let rate = 16000;
  if (input.format === "wav") {
    rate = readWavSampleRateHeader(input.audioBytes) ?? 16000;
    pcm = input.audioBytes.byteLength > 44 ? input.audioBytes.subarray(44) : input.audioBytes;
  } else if (input.format === "pcm16le") {
    pcm = pcm16leMonoToWav(input.audioBytes).subarray(44);
    rate = 16000;
  } else {
    pcm = pcm16leMonoToWav(input.audioBytes).subarray(44);
  }
  return {
    contentB64: Buffer.from(pcm).toString("base64"),
    encoding: "LINEAR16",
    sampleRateHertz: rate,
    languageCode: primary,
    alternatives,
  };
}

export class GoogleSpeechToTextProvider implements ISpeechToTextProvider {
  readonly name: string;
  private credsMemo: Promise<GoogleServiceAccountCredentials> | null = null;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string },
  ) {
    this.name = opts?.name ?? "google-stt";
  }

  private async creds(): Promise<GoogleServiceAccountCredentials> {
    this.credsMemo ??= resolveGoogleServiceAccountCredentials(this.cfg);
    return this.credsMemo;
  }

  async transcribeAudioChunk(
    input: { audioBytes: Uint8Array; format: string; hintLanguage?: string },
    options?: { signal?: AbortSignal },
  ): Promise<SttChunkResult> {
    const creds = await this.creds();
    const project = this.cfg.googleCloudProjectId.trim() || creds.project_id?.trim() || "";
    if (!project) {
      throw new VoiceProviderError("GOOGLE_CLOUD_PROJECT_ID missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
        retryable: false,
      });
    }
    const token = await getGoogleAccessToken(creds, ["https://www.googleapis.com/auth/cloud-platform"]);
    const { contentB64, encoding, sampleRateHertz, languageCode, alternatives } = toAudioContentAndConfig(input);
    const model =
      this.cfg.sttModelSecondary && this.cfg.sttModelSecondary !== "google-stt-default"
        ? this.cfg.sttModelSecondary
        : "default";
    const url = "https://speech.googleapis.com/v1/speech:recognize";
    const body = {
      config: {
        encoding,
        sampleRateHertz,
        languageCode,
        alternativeLanguageCodes: alternatives,
        model,
        enableAutomaticPunctuation: true,
      },
      audio: { content: contentB64 },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-goog-user-project": project,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new VoiceProviderError(
        `Google STT HTTP ${res.status} ${errText.slice(0, 200)}`,
        VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
        { httpStatus: res.status, retryable: res.status === 429 || res.status >= 500 },
      );
    }
    const json = (await res.json()) as RecognizeResponse;
    const top = json.results?.[0];
    const alt = top?.alternatives?.[0];
    const transcript = alt?.transcript?.trim() ?? "";
    if (!transcript) {
      throw new VoiceProviderError("Google STT empty transcript", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
        retryable: false,
      });
    }
    const confidence = typeof alt?.confidence === "number" ? alt.confidence : 0.8;
    const langTag = top?.languageCode ?? languageCode;
    return {
      transcript,
      languageCode: normalizeCallLanguageCode(langTag),
      confidence,
      isPartial: false,
      sttModelUsed: model,
    };
  }
}
