import type { SynthesizeTextRequest, SynthesizedUtterance } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

async function resolveOpenAiKey(cfg: MultilingualVoiceConfig): Promise<string> {
  const key = await resolvePlainOrSecretArn(cfg.openAiApiKey, cfg.openAiApiKeySecretArn, {
    preferredField: "apiKey",
  });
  if (!key.trim()) {
    throw new VoiceProviderError(
      "OpenAI API key missing (set OPENAI_API_KEY or OPENAI_API_KEY_SECRET_ARN)",
      VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR,
      { retryable: false },
    );
  }
  return key;
}

function pickOpenAiVoice(preferredGender?: SynthesizeTextRequest["preferredGender"]): string {
  if (preferredGender === "MALE") return "echo";
  if (preferredGender === "NEUTRAL") return "alloy";
  return "nova";
}

/**
 * OpenAI TTS (`tts-1` by default). Secondary to Azure Neural TTS.
 */
export async function openaiTtsSynthesize(args: {
  cfg: MultilingualVoiceConfig;
  request: SynthesizeTextRequest;
  signal?: AbortSignal;
}): Promise<SynthesizedUtterance> {
  const text = args.request.text.trim().slice(0, 4096);
  if (!text) {
    throw new VoiceProviderError("Empty TTS text", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  const key = await resolveOpenAiKey(args.cfg);
  const base = (args.cfg.openAiBaseUrl.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "tts-1";
  const voice = args.request.voiceName?.trim() || pickOpenAiVoice(args.request.preferredGender);
  const res = await fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: "mp3",
      speed: args.request.speakingRate && args.request.speakingRate > 0 ? args.request.speakingRate : 1,
    }),
    signal: args.signal,
  });
  if (!res.ok) {
    throw new VoiceProviderError(`OpenAI TTS HTTP ${res.status}`, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      httpStatus: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 32) {
    throw new VoiceProviderError("OpenAI TTS empty audio", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  return {
    audioContent: buf,
    mimeType: "audio/mpeg",
    voiceName: voice,
    languageCode: args.request.languageBcp,
    encoding: "MP3",
  };
}
