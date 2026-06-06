import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { toTranslatePrimaryTag } from "rapid-cortex-shared";
import { VoiceProviderError } from "../../voice/providerErrors.js";
import { VOICE_ERROR_CODES } from "../../voice/voiceErrorCodes.js";

const client = new TranslateClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export type AwsTranslateTextResult = {
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
};

/**
 * General-purpose AWS Translate call (any supported language pair).
 */
export async function awsTranslateText(args: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  signal?: AbortSignal;
}): Promise<AwsTranslateTextResult> {
  const text = args.text.slice(0, 10_000).trim();
  if (!text) {
    throw new VoiceProviderError("Empty text for AWS translate", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  const src = toTranslatePrimaryTag(args.sourceLanguage);
  const tgt = toTranslatePrimaryTag(args.targetLanguage);
  if (src === tgt) {
    return { translated: text, sourceLanguage: src, targetLanguage: tgt, confidence: 1 };
  }
  if (src === "und" || tgt === "und") {
    throw new VoiceProviderError("Unsupported language pair for AWS translate", VOICE_ERROR_CODES.UNSUPPORTED_LANGUAGE, {
      retryable: false,
    });
  }
  const out = await client.send(
    new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: src,
      TargetLanguageCode: tgt,
    }),
    { abortSignal: args.signal },
  );
  const translated = (out.TranslatedText ?? "").trim();
  if (!translated) {
    throw new VoiceProviderError("AWS translate empty", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  return {
    translated,
    sourceLanguage: src,
    targetLanguage: tgt,
    confidence: 0.92,
  };
}
