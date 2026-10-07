import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import type { ITranslationProvider, TranslationResult } from "../interfaces.js";

export class AwsTranslateProvider implements ITranslationProvider {
  readonly name: string;
  private readonly client: TranslateClient;

  constructor(opts?: { name?: string; region?: string }) {
    this.name = opts?.name ?? "aws-translate";
    this.client = new TranslateClient({ region: opts?.region ?? process.env.AWS_REGION });
  }

  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: "en",
    options?: { signal?: AbortSignal },
  ): Promise<TranslationResult> {
    const src = sourceLanguage.split("-")[0]?.toLowerCase() ?? "auto";
    if (targetLanguage !== "en") {
      return { translated: text, confidence: 0.5, sourceLanguage: src, targetLanguage: "en" };
    }
    if (src === "en") {
      return { translated: text, confidence: 1, sourceLanguage: "en", targetLanguage: "en" };
    }
    const out = await this.client.send(
      new TranslateTextCommand({
        Text: text.slice(0, 10_000),
        SourceLanguageCode: src,
        TargetLanguageCode: "en",
      }),
      { abortSignal: options?.signal },
    );
    const translated = out.TranslatedText ?? text;
    return {
      translated,
      confidence: 0.92,
      sourceLanguage: src,
      targetLanguage: "en",
    };
  }
}
