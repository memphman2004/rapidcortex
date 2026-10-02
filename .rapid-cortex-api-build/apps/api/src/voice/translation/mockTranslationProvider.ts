import type { ITranslationProvider, TranslationResult } from "../interfaces.js";

export class MockTranslationProvider implements ITranslationProvider {
  readonly name: string;
  constructor(opts?: { name?: string }) {
    this.name = opts?.name ?? "mock-translation";
  }

  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: "en",
  ): Promise<TranslationResult> {
    const src = sourceLanguage.split("-")[0]?.toLowerCase() ?? "en";
    if (targetLanguage !== "en") {
      return { translated: text, confidence: 0.5, sourceLanguage: src, targetLanguage: "en" };
    }
    if (src === "en") {
      return { translated: text, confidence: 1, sourceLanguage: "en", targetLanguage: "en" };
    }
    /** Deterministic tiny lexicon for tests — production uses AWS Translate provider. */
    const table: Record<string, string> = {
      hola: "hello",
      gracias: "thank you",
      fuego: "fire",
      ayuda: "help",
    };
    const lower = text.toLowerCase();
    let translated = text;
    for (const [k, v] of Object.entries(table)) {
      if (lower.includes(k)) {
        translated = text.replace(new RegExp(k, "gi"), v);
      }
    }
    if (translated === text && src !== "en") {
      translated = `[${src}] ${text}`;
    }
    return {
      translated,
      confidence: 0.88,
      sourceLanguage: src,
      targetLanguage: "en",
    };
  }
}
