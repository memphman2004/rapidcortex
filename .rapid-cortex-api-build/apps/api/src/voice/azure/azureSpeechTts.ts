import type { SynthesizeTextRequest, SynthesizedUtterance } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { toAzureTtsVoice } from "../languageLocales.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function resolveSpeechKey(cfg: MultilingualVoiceConfig): Promise<string> {
  const key = await resolvePlainOrSecretArn(cfg.azureSpeechKey, cfg.azureSpeechKeySecretArn, {
    preferredField: "azureSpeechKey",
  });
  if (!key.trim()) {
    throw new VoiceProviderError("Azure Speech key missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
      retryable: false,
    });
  }
  return key;
}

/**
 * Azure Neural TTS (same Speech resource as STT). REST short-audio synthesis.
 */
export async function azureSpeechSynthesize(args: {
  cfg: MultilingualVoiceConfig;
  request: SynthesizeTextRequest;
  signal?: AbortSignal;
}): Promise<SynthesizedUtterance> {
  const text = args.request.text.trim().slice(0, 4500);
  if (!text) {
    throw new VoiceProviderError("Empty TTS text", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  const key = await resolveSpeechKey(args.cfg);
  const region = args.cfg.azureSpeechRegion.trim() || "eastus";
  const picked = args.request.voiceName?.trim()
    ? { locale: toAzureTtsVoice(args.request.languageBcp).locale, voiceName: args.request.voiceName.trim() }
    : toAzureTtsVoice(args.request.languageBcp, args.request.preferredGender);
  const rate = args.request.speakingRate;
  let prosodyOpen = "";
  if (typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate !== 1) {
    const pct = Math.round((rate - 1) * 100);
    const signed = pct >= 0 ? `+${pct}%` : `${pct}%`;
    prosodyOpen = `<prosody rate="${signed}">`;
  }
  const prosodyClose = prosodyOpen ? "</prosody>" : "";
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${picked.locale}">` +
    `<voice name="${picked.voiceName}">${prosodyOpen}${escapeSsml(text)}${prosodyClose}</voice></speak>`;

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      Accept: "audio/mpeg",
    },
    body: ssml,
    signal: args.signal,
  });
  if (!res.ok) {
    throw new VoiceProviderError(`Azure TTS HTTP ${res.status}`, VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      httpStatus: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 32) {
    throw new VoiceProviderError("Azure TTS empty audio", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  return {
    audioContent: buf,
    mimeType: "audio/mpeg",
    voiceName: picked.voiceName,
    languageCode: picked.locale,
    encoding: "MP3",
  };
}
