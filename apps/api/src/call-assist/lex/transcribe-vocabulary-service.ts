import {
  CreateVocabularyCommand,
  GetVocabularyCommand,
  TranscribeClient,
  UpdateVocabularyCommand,
} from "@aws-sdk/client-transcribe";
import { env } from "../../lib/env.js";

function client(): TranscribeClient {
  return new TranscribeClient({ region: env.region || process.env.AWS_REGION || "us-east-1" });
}

function languageCode(locale: string): string {
  const normalized = locale.replace("_", "-");
  if (normalized.toLowerCase().startsWith("es")) return "es-US";
  return "en-US";
}

/**
 * Creates or updates a custom Transcribe vocabulary for agency-specific place names / jargon.
 */
export class TranscribeVocabularyService {
  async createAgencyVocabulary(agencyId: string, locale: string, phrases: string[]): Promise<string> {
    const name = `rc-call-assist-${agencyId}-${locale}`.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 200);
    const phrasesClean = [...new Set(phrases.map((p) => p.trim()).filter(Boolean))].slice(0, 1000);
    if (!phrasesClean.length) return name;

    // Explicit mock / CI — return deterministic name without calling AWS.
    if (
      process.env.CALL_ASSIST_TRANSCRIBE_MOCK === "true" ||
      process.env.CALL_ASSIST_TRANSCRIBE_MOCK === "1"
    ) {
      return name;
    }

    const transcribe = client();
    const language = languageCode(locale);

    try {
      const existing = await transcribe.send(new GetVocabularyCommand({ VocabularyName: name }));
      if (existing.VocabularyState === "PENDING" || existing.VocabularyState === "READY") {
        await transcribe.send(
          new UpdateVocabularyCommand({
            VocabularyName: name,
            LanguageCode: language as "en-US" | "es-US",
            Phrases: phrasesClean,
          }),
        );
        return name;
      }
    } catch {
      // NotFound / BadRequest → create below
    }

    try {
      await transcribe.send(
        new CreateVocabularyCommand({
          VocabularyName: name,
          LanguageCode: language as "en-US" | "es-US",
          Phrases: phrasesClean,
        }),
      );
    } catch (err) {
      const n = err instanceof Error ? err.name : "";
      if (n === "ConflictException") {
        await transcribe.send(
          new UpdateVocabularyCommand({
            VocabularyName: name,
            LanguageCode: language as "en-US" | "es-US",
            Phrases: phrasesClean,
          }),
        );
      } else {
        throw err;
      }
    }
    return name;
  }
}
