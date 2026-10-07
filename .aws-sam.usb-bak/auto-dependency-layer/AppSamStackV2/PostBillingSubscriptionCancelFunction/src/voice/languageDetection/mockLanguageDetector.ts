import type { ILanguageDetector, LanguageDetectionResult } from "../interfaces.js";

export class MockLanguageDetector implements ILanguageDetector {
  readonly name: string;
  constructor(opts?: { name?: string }) {
    this.name = opts?.name ?? "mock-language-detector";
  }

  async detectFromText(text: string): Promise<LanguageDetectionResult> {
    const t = text.trim();
    if (!t) {
      return {
        language: "und",
        confidence: 0,
        alternatives: [],
        detectionMethod: "mock",
      };
    }
    if (/[ñáéíóúü¿¡]/.test(t)) {
      return {
        language: "es",
        confidence: 0.82,
        alternatives: [{ language: "pt", confidence: 0.1 }],
        detectionMethod: "heuristic",
      };
    }
    if (/[\u4e00-\u9fff]/.test(t)) {
      return {
        language: "zh",
        confidence: 0.78,
        alternatives: [{ language: "ja", confidence: 0.05 }],
        detectionMethod: "heuristic",
      };
    }
    if (/[а-яА-ЯёЁ]/.test(t)) {
      return { language: "ru", confidence: 0.8, alternatives: [], detectionMethod: "heuristic" };
    }
    return {
      language: "en",
      confidence: 0.75,
      alternatives: [{ language: "es", confidence: 0.12 }],
      detectionMethod: "heuristic",
    };
  }
}
