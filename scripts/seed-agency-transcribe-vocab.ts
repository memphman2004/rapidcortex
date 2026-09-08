/**
 * Merge baseline public-safety Transcribe vocabulary with an agency overlay CSV.
 *
 * Usage:
 *   AGENCY_ID=kcpd VOCAB_FILE=./vocabs/kcpd-en-US.csv npx tsx scripts/seed-agency-transcribe-vocab.ts
 *
 * Does not call AWS unless TRANSCRIBE_VOCAB_NAME is set.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENCY_ID = process.env.AGENCY_ID?.trim() || "";
const VOCAB_FILE = process.env.VOCAB_FILE?.trim() || "";
const BASELINE = process.env.BASELINE_VOCAB_FILE?.trim() || join(ROOT, "vocabs/baseline-en-US.csv");
const LANGUAGE = process.env.VOCAB_LANGUAGE_CODE?.trim() || "en-US";

type Row = { Phrase: string; SoundsLike: string; IPA: string; DisplayAs: string };

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const phraseIdx = header.findIndex((h) => h.toLowerCase() === "phrase");
  if (phraseIdx < 0) {
    throw new Error("CSV must include a Phrase column");
  }
  const soundsIdx = header.findIndex((h) => h.toLowerCase() === "soundslike");
  const ipaIdx = header.findIndex((h) => h.toLowerCase() === "ipa");
  const displayIdx = header.findIndex((h) => h.toLowerCase() === "displayas");
  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const phrase = cols[phraseIdx];
    if (!phrase) continue;
    rows.push({
      Phrase: phrase,
      SoundsLike: soundsIdx >= 0 ? cols[soundsIdx] ?? "" : "",
      IPA: ipaIdx >= 0 ? cols[ipaIdx] ?? "" : "",
      DisplayAs: displayIdx >= 0 ? cols[displayIdx] ?? "" : "",
    });
  }
  return rows;
}

function merge(baseline: Row[], overlay: Row[]): Row[] {
  const byPhrase = new Map<string, Row>();
  for (const row of [...baseline, ...overlay]) {
    byPhrase.set(row.Phrase.toLowerCase(), row);
  }
  return [...byPhrase.values()].sort((a, b) => a.Phrase.localeCompare(b.Phrase));
}

function toCsv(rows: Row[]): string {
  const header = "Phrase,SoundsLike,IPA,DisplayAs";
  const body = rows.map((r) => [r.Phrase, r.SoundsLike, r.IPA, r.DisplayAs].join(","));
  return [header, ...body].join("\n") + "\n";
}

if (!AGENCY_ID) {
  console.error("Set AGENCY_ID");
  process.exit(1);
}

const overlayPath = VOCAB_FILE ? resolve(VOCAB_FILE) : join(ROOT, "vocabs", `${AGENCY_ID}-${LANGUAGE}.csv`);
const baselineRows = parseCsv(readFileSync(BASELINE, "utf8"));
let overlayRows: Row[] = [];
try {
  overlayRows = parseCsv(readFileSync(overlayPath, "utf8"));
} catch {
  if (VOCAB_FILE) {
    console.error(`VOCAB_FILE not readable: ${overlayPath}`);
    process.exit(1);
  }
}

const merged = merge(baselineRows, overlayRows);
const outDir = join(ROOT, "vocabs", "generated");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${AGENCY_ID}-${LANGUAGE}.csv`);
writeFileSync(outFile, toCsv(merged));
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
