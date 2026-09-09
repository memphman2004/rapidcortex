/**
 * Merge baseline public-safety Transcribe vocabulary with an agency overlay CSV.
 *
 * Usage:
 *   AGENCY_ID=kcpd VOCAB_FILE=./vocabs/generated/kcpd-en-US.csv npx tsx scripts/seed-agency-transcribe-vocab.ts
 *
 * Does not call AWS unless TRANSCRIBE_VOCAB_NAME is set.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeVocabEntries, parseVocabCsv, toVocabCsv } from "./lib/transcribe-vocab.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENCY_ID = process.env.AGENCY_ID?.trim() || "";
const VOCAB_FILE = process.env.VOCAB_FILE?.trim() || "";
const BASELINE = process.env.BASELINE_VOCAB_FILE?.trim() || join(ROOT, "vocabs/baseline-en-US.csv");
const LANGUAGE = process.env.VOCAB_LANGUAGE_CODE?.trim() || "en-US";

if (!AGENCY_ID) {
  console.error("Set AGENCY_ID");
  process.exit(1);
}

const overlayPath = VOCAB_FILE ? resolve(VOCAB_FILE) : join(ROOT, "vocabs", `${AGENCY_ID}-${LANGUAGE}.csv`);
const baselineRows = parseVocabCsv(readFileSync(BASELINE, "utf8"));
let overlayRows: ReturnType<typeof parseVocabCsv> = [];
try {
  overlayRows = parseVocabCsv(readFileSync(overlayPath, "utf8"));
} catch {
  if (VOCAB_FILE) {
    console.error(`VOCAB_FILE not readable: ${overlayPath}`);
    process.exit(1);
  }
}

const merged = mergeVocabEntries([baselineRows, overlayRows]);
const outDir = join(ROOT, "vocabs", "generated");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${AGENCY_ID}-${LANGUAGE}.csv`);
writeFileSync(outFile, toVocabCsv(merged));
console.log(`Merged ${baselineRows.length} baseline + ${overlayRows.length} overlay → ${merged.length} phrases`);
console.log(`Wrote ${outFile}`);

const vocabName = process.env.TRANSCRIBE_VOCAB_NAME?.trim();
if (!vocabName) {
  console.log("TRANSCRIBE_VOCAB_NAME unset — skipped Transcribe upload (dry run).");
  process.exit(0);
}

const { TranscribeClient, CreateVocabularyCommand, UpdateVocabularyCommand } = await import(
  "@aws-sdk/client-transcribe"
);
const client = new TranscribeClient({ region: process.env.AWS_REGION || "us-east-1" });
const phrases = merged.map((r) => r.Phrase);
try {
  await client.send(
    new UpdateVocabularyCommand({
      VocabularyName: vocabName,
      LanguageCode: LANGUAGE as "en-US",
      Phrases: phrases,
    }),
  );
  console.log(`Updated Transcribe vocabulary ${vocabName}`);
} catch {
  await client.send(
    new CreateVocabularyCommand({
      VocabularyName: vocabName,
      LanguageCode: LANGUAGE as "en-US",
      Phrases: phrases,
    }),
  );
  console.log(`Created Transcribe vocabulary ${vocabName}`);
}
