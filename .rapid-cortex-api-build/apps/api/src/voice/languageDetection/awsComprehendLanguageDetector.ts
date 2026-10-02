import { ComprehendClient, DetectDominantLanguageCommand } from "@aws-sdk/client-comprehend";
import type { ILanguageDetector, LanguageDetectionResult } from "../interfaces.js";

export class AwsComprehendLanguageDetector implements ILanguageDetector {
  readonly name: string;
  private readonly client: ComprehendClient;

  constructor(opts?: { name?: string; region?: string }) {
    this.name = opts?.name ?? "aws-comprehend-language-detector";
    this.client = new ComprehendClient({ region: opts?.region ?? process.env.AWS_REGION });
  }

  async detectFromText(text: string, options?: { signal?: AbortSignal }): Promise<LanguageDetectionResult> {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      return {
        language: "und",
        confidence: 0,
        alternatives: [],
        detectionMethod: "comprehend",
      };
    }
    const out = await this.client.send(
      new DetectDominantLanguageCommand({ Text: trimmed.slice(0, 5000) }),
      { abortSignal: options?.signal },
    );
    const langs = out.Languages ?? [];
    const top = langs[0];
    if (!top?.LanguageCode) {
      return { language: "und", confidence: 0, alternatives: [], detectionMethod: "comprehend" };
    }
    const primary = top.LanguageCode.split("-")[0] ?? top.LanguageCode;
    const alternatives = langs.slice(1, 4).flatMap((l) =>
      l.LanguageCode && l.Score != null
        ? [{ language: l.LanguageCode.split("-")[0]!, confidence: l.Score }]
        : [],
    );
    return {
      language: primary,
      confidence: top.Score ?? 0,
      alternatives,
      detectionMethod: "comprehend",
    };
  }
}
