import type { SynthesizeTextRequest, SynthesizedUtterance, TextToSpeechAudioEncoding } from "rapid-cortex-shared";
import { toGoogleTtsLanguageCode } from "rapid-cortex-shared";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

/** Default Neural2 / Wavenet voice when no explicit name (per language code prefix). */
export function pickGoogleTtsVoiceName(languageBcp: string, preferredGender?: SynthesizeTextRequest["preferredGender"]): {
  languageCode: string;
  voiceName: string;
} {
  const languageCode = toGoogleTtsLanguageCode(languageBcp);
  const primary = languageBcp.split("-")[0]?.toLowerCase() ?? "en";
  const female = preferredGender !== "MALE";
  const table: Record<string, { female: string; male: string }> = {
    "en-US": { female: "en-US-Neural2-C", male: "en-US-Neural2-D" },
    "en-GB": { female: "en-GB-Neural2-A", male: "en-GB-Neural2-B" },
    "es-US": { female: "es-US-Neural2-A", male: "es-US-Neural2-B" },
    "fr-FR": { female: "fr-FR-Neural2-A", male: "fr-FR-Neural2-B" },
    "de-DE": { female: "de-DE-Neural2-F", male: "de-DE-Neural2-B" },
    "pt-BR": { female: "pt-BR-Neural2-A", male: "pt-BR-Neural2-B" },
    "cmn-Hans": { female: "cmn-CN-Wavenet-A", male: "cmn-CN-Wavenet-B" },
    "ja-JP": { female: "ja-JP-Neural2-B", male: "ja-JP-Neural2-C" },
    "ko-KR": { female: "ko-KR-Neural2-A", male: "ko-KR-Neural2-C" },
    "ar-XA": { female: "ar-XA-Wavenet-A", male: "ar-XA-Wavenet-B" },
    "hi-IN": { female: "hi-IN-Neural2-A", male: "hi-IN-Neural2-B" },
    "ru-RU": { female: "ru-RU-Wavenet-A", male: "ru-RU-Wavenet-B" },
  };
  const row = table[languageCode];
  if (row) {
    return { languageCode, voiceName: female ? row.female : row.male };
  }
  /* Rare locales: use US English TTS rather than an invalid auto-generated name. */
  if (!/^([a-z]{2})-/.test(languageCode)) {
    return { languageCode: "en-US", voiceName: female ? "en-US-Neural2-C" : "en-US-Neural2-D" };
  }
  return { languageCode, voiceName: female ? "en-US-Neural2-C" : "en-US-Neural2-D" };
}

const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export async function googleTextToSpeechSynthesize(args: {
  accessToken: string;
  request: SynthesizeTextRequest;
  signal?: AbortSignal;
}): Promise<SynthesizedUtterance> {
  const text = args.request.text.trim().slice(0, 4500);
  if (!text) {
    throw new VoiceProviderError("Empty TTS text", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, { retryable: false });
  }
  const explicit = args.request.voiceName?.trim();
  const picked = explicit
    ? { languageCode: toGoogleTtsLanguageCode(args.request.languageBcp), voiceName: explicit }
    : pickGoogleTtsVoiceName(args.request.languageBcp, args.request.preferredGender);
  const encoding: TextToSpeechAudioEncoding = args.request.audioEncoding ?? "MP3";
  const audioEncoding = encoding === "LINEAR16" ? "LINEAR16" : encoding === "OGG_OPUS" ? "OGG_OPUS" : "MP3";

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: picked.languageCode, name: picked.voiceName },
      audioConfig: {
        audioEncoding,
        speakingRate: args.request.speakingRate ?? 1.0,
      },
    }),
    signal: args.signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new VoiceProviderError(
      `Google TTS HTTP ${res.status} ${t.slice(0, 500)}`,
      res.status === 429 ? VOICE_ERROR_CODES.STT_RATE_LIMIT : VOICE_ERROR_CODES.STT_INVALID_RESPONSE,
      { httpStatus: res.status, retryable: res.status === 429 || res.status >= 500 },
    );
  }
  const json = (await res.json()) as { audioContent?: string };
  const b64 = json.audioContent;
  if (!b64) {
    throw new VoiceProviderError("Google TTS empty audio", VOICE_ERROR_CODES.STT_INVALID_RESPONSE, { retryable: false });
  }
  const bytes = Buffer.from(b64, "base64");
  return {
    audioContent: new Uint8Array(bytes),
    mimeType: encoding === "MP3" ? "audio/mpeg" : encoding === "OGG_OPUS" ? "audio/ogg" : "audio/pcm",
    voiceName: picked.voiceName,
    languageCode: picked.languageCode,
    encoding: encoding as TextToSpeechAudioEncoding,
  };
}
