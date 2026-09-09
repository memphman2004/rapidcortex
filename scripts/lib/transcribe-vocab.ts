/**
 * Pure helpers for Call Assist Transcribe custom vocabularies.
 * Network I/O lives in scripts/generate-transcribe-vocab.ts.
 */

export type VocabEntry = {
  Phrase: string;
  SoundsLike?: string;
  IPA?: string;
  DisplayAs: string;
};

/** Common street types Transcribe already handles — skip these as standalone entries. */
export const SKIP_PATTERNS =
  /^(North|South|East|West|NE|NW|SE|SW|N|S|E|W)?\s*(Main|Park|Oak|Elm|Pine|Maple|Cedar|Lake|Hill|Valley|River|Church|School|Washington|Lincoln|Jefferson|Adams|Jackson|Madison|Monroe|Grant|Franklin|Roosevelt)\s*(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)$/i;

/** Terms Transcribe already knows — no point adding these. */
export const GENERIC_TYPES = new Set([
  "Street",
  "Avenue",
  "Road",
  "Drive",
  "Lane",
  "Boulevard",
  "Court",
  "Place",
  "Way",
  "Circle",
  "Trail",
  "Path",
]);

/** TIGER/Line road MTFCC codes (skip rail, hydro, and other non-street edges). */
export const ROAD_MTFCC = /^S1/;

/** AWS Transcribe custom-vocabulary Phrase character set. */
const PHRASE_DISALLOWED = /[^A-Za-z0-9'.\- ]/g;

export const DEFAULT_MAX_PHRASES = 45_000;
export const TRANSCRIBE_PHRASE_LIMIT = 50_000;

export interface CountyBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function parseCountyFipsList(raw: string): string[] {
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("COUNTY_FIPS is required (5-digit county FIPS, comma-separated for multi-county)");
  }
  for (const part of parts) {
    if (!/^\d{5}$/.test(part)) {
      throw new Error(`COUNTY_FIPS values must be 5 digits (got "${part}")`);
    }
  }
  return [...new Set(parts)];
}

export function sanitizeAgencyId(raw: string): string {
  const id = raw.trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
    throw new Error("AGENCY_ID must be 1–64 letters, digits, hyphens, or underscores");
  }
  return id.toLowerCase();
}

export function sanitizePhrase(raw: string): string {
  return raw
    .replace(/[–—]/g, "-")
    .replace(/,/g, " ")
    .replace(PHRASE_DISALLOWED, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 256);
}

export function getBasePublicSafetyVocab(): VocabEntry[] {
  return [
    { Phrase: "BOLO", DisplayAs: "BOLO" },
    { Phrase: "EMS", DisplayAs: "EMS" },
    { Phrase: "CAD", DisplayAs: "CAD" },
    { Phrase: "PSAP", DisplayAs: "PSAP" },
    { Phrase: "APB", DisplayAs: "APB" },
    { Phrase: "DUI", DisplayAs: "DUI" },
    { Phrase: "DWI", DisplayAs: "DWI" },
    { Phrase: "MVA", DisplayAs: "MVA" },
    { Phrase: "welfare check", DisplayAs: "welfare check" },
    { Phrase: "fender-bender", DisplayAs: "fender-bender" },
    { Phrase: "carjacking", DisplayAs: "carjacking" },
    { Phrase: "porch pirate", DisplayAs: "porch pirate" },
    { Phrase: "catalytic converter", DisplayAs: "catalytic converter" },
    { Phrase: "non-emergency", DisplayAs: "non-emergency" },
    { Phrase: "pickup truck", DisplayAs: "pickup truck" },
    { Phrase: "semi-truck", DisplayAs: "semi-truck" },
    { Phrase: "northbound", DisplayAs: "northbound" },
    { Phrase: "southbound", DisplayAs: "southbound" },
    { Phrase: "eastbound", DisplayAs: "eastbound" },
    { Phrase: "westbound", DisplayAs: "westbound" },
  ];
}

export function normalizeVocabEntry(entry: VocabEntry): VocabEntry | null {
  const phrase = sanitizePhrase(entry.Phrase);
  if (!phrase || phrase.length < 2) return null;
  const display = sanitizePhrase(entry.DisplayAs || phrase) || phrase;
  const sounds = entry.SoundsLike ? sanitizePhrase(entry.SoundsLike) : "";
  const ipa = (entry.IPA ?? "").trim();
  return {
    Phrase: phrase,
    SoundsLike: sounds || undefined,
    IPA: ipa || undefined,
    DisplayAs: display,
  };
}

export function filterStreetNames(names: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const raw of names) {
    const name = sanitizePhrase(raw);
    if (!name || name.length < 3) continue;
    if (GENERIC_TYPES.has(name)) continue;
    if (SKIP_PATTERNS.test(name)) continue;
    out.add(name);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function mergeVocabEntries(layers: VocabEntry[][]): VocabEntry[] {
  const byPhrase = new Map<string, VocabEntry>();
  for (const layer of layers) {
    for (const raw of layer) {
      const entry = normalizeVocabEntry(raw);
      if (!entry) continue;
      byPhrase.set(entry.Phrase.toLowerCase(), entry);
    }
  }
  return [...byPhrase.values()].sort((a, b) => a.Phrase.localeCompare(b.Phrase));
}

/**
 * Keep every reserved (base/overlay) phrase, then fill remaining slots with
 * longer street names first so distinctive names survive the 50k Transcribe cap.
 */
export function capVocabEntries(
  reserved: VocabEntry[],
  streets: VocabEntry[],
  maxPhrases: number,
): { entries: VocabEntry[]; truncated: number } {
  const cap = Math.min(Math.max(1, maxPhrases), TRANSCRIBE_PHRASE_LIMIT);
  const byPhrase = new Map<string, VocabEntry>();
  for (const raw of reserved) {
    const entry = normalizeVocabEntry(raw);
    if (!entry) continue;
    byPhrase.set(entry.Phrase.toLowerCase(), entry);
  }
  const remaining = Math.max(0, cap - byPhrase.size);
  const ranked = [...streets]
    .map((e) => normalizeVocabEntry(e))
    .filter((e): e is VocabEntry => Boolean(e))
    .sort((a, b) => b.Phrase.length - a.Phrase.length || a.Phrase.localeCompare(b.Phrase));

  let added = 0;
  let skipped = 0;
  for (const entry of ranked) {
    const key = entry.Phrase.toLowerCase();
    if (byPhrase.has(key)) continue;
    if (added >= remaining) {
      skipped += 1;
      continue;
    }
    byPhrase.set(key, entry);
    added += 1;
  }

  const entries = [...byPhrase.values()].sort((a, b) => a.Phrase.localeCompare(b.Phrase));
  return { entries, truncated: skipped };
}

export function streetsToEntries(names: string[]): VocabEntry[] {
  return filterStreetNames(names).map((name) => ({
    Phrase: name,
    DisplayAs: name,
  }));
}

export function parseVocabCsv(text: string): VocabEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.trim());
  const phraseIdx = header.findIndex((h) => h.toLowerCase() === "phrase");
  if (phraseIdx < 0) {
    throw new Error("CSV must include a Phrase column");
  }
  const soundsIdx = header.findIndex((h) => h.toLowerCase() === "soundslike");
  const ipaIdx = header.findIndex((h) => h.toLowerCase() === "ipa");
  const displayIdx = header.findIndex((h) => h.toLowerCase() === "displayas");
  const rows: VocabEntry[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const phrase = (cols[phraseIdx] ?? "").trim();
    if (!phrase) continue;
    rows.push({
      Phrase: phrase,
      SoundsLike: soundsIdx >= 0 ? (cols[soundsIdx] ?? "").trim() : "",
      IPA: ipaIdx >= 0 ? (cols[ipaIdx] ?? "").trim() : "",
      DisplayAs: displayIdx >= 0 ? (cols[displayIdx] ?? "").trim() || phrase : phrase,
    });
  }
  return rows;
}

export function toVocabCsv(entries: VocabEntry[]): string {
  const header = "Phrase,SoundsLike,IPA,DisplayAs";
  const body = entries.map((e) =>
    [e.Phrase, e.SoundsLike ?? "", e.IPA ?? "", e.DisplayAs || e.Phrase].map(csvEscape).join(","),
  );
  return `${[header, ...body].join("\n")}\n`;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function bboxFromTigerWebExtent(json: unknown): CountyBbox {
  const extent = (json as { extent?: { xmin: number; ymin: number; xmax: number; ymax: number } } | null)
    ?.extent;
  if (
    !extent ||
    ![extent.xmin, extent.ymin, extent.xmax, extent.ymax].every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    throw new Error("TigerWeb response missing a numeric extent");
  }
  return { west: extent.xmin, south: extent.ymin, east: extent.xmax, north: extent.ymax };
}

export function unionBboxes(boxes: CountyBbox[]): CountyBbox {
  if (boxes.length === 0) {
    throw new Error("unionBboxes requires at least one bbox");
  }
  return {
    south: Math.min(...boxes.map((b) => b.south)),
    west: Math.min(...boxes.map((b) => b.west)),
    north: Math.max(...boxes.map((b) => b.north)),
    east: Math.max(...boxes.map((b) => b.east)),
  };
}

export function overpassBboxClause(bbox: CountyBbox): string {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

export function buildOverpassStreetQuery(bbox: CountyBbox, timeoutSec = 180): string {
  const box = overpassBboxClause(bbox);
  return `[out:json][timeout:${timeoutSec}];
(
  way["highway"]["name"](${box});
);
out tags;`;
}

export function streetNamesFromOverpass(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const elements = (payload as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];
  const names: string[] = [];
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const tags = (el as { tags?: Record<string, string> }).tags;
    if (!tags) continue;
    if (tags.name) names.push(tags.name);
    if (tags["name:en"] && tags["name:en"] !== tags.name) names.push(tags["name:en"]);
    if (tags.alt_name) {
      for (const part of tags.alt_name.split(";")) {
        const alt = part.trim();
        if (alt) names.push(alt);
      }
    }
    const highway = tags.highway ?? "";
    if (tags.ref && /^(motorway|trunk|primary)/.test(highway)) {
      names.push(tags.ref.replace(/\s+/g, "-"));
    }
  }
  return names;
}

export function readDbfRecords(buf: Buffer): Record<string, string>[] {
  if (buf.length < 32) {
    throw new Error("DBF too small");
  }
  const recordCount = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  if (headerLen < 33 || recordLen < 1) {
    throw new Error("Invalid DBF header");
  }

  const fields: { name: string; length: number; offset: number }[] = [];
  let offset = 32;
  let recOffset = 1;
  while (offset < headerLen - 1 && buf[offset] !== 0x0d) {
    const name = buf
      .subarray(offset, offset + 11)
      .toString("ascii")
      .replace(/\0.*$/, "")
      .trim();
    const length = buf[offset + 16] ?? 0;
    if (!name || length === 0) break;
    fields.push({ name, length, offset: recOffset });
    recOffset += length;
    offset += 32;
  }

  const records: Record<string, string>[] = [];
  let pos = headerLen;
  for (let i = 0; i < recordCount; i++) {
    if (pos + recordLen > buf.length) break;
    if (buf[pos] === 0x2a) {
      pos += recordLen;
      continue;
    }
    const rec: Record<string, string> = {};
    for (const field of fields) {
      rec[field.name] = buf
        .subarray(pos + field.offset, pos + field.offset + field.length)
        .toString("latin1")
        .trim();
    }
    records.push(rec);
    pos += recordLen;
  }
  return records;
}

export function fullnamesFromDbfRecords(records: Record<string, string>[]): string[] {
  const names: string[] = [];
  for (const rec of records) {
    const mtfcc = (rec.MTFCC || rec.mtfcc || "").trim();
    if (mtfcc && !ROAD_MTFCC.test(mtfcc)) continue;
    const full = (rec.FULLNAME || rec.FULL_NAME || rec.fullname || "").trim();
    if (full) names.push(full);
  }
  return names;
}

export function tigerZipUrl(fips: string, year: number, layer: "edges" | "roads"): string {
  const dir = layer === "roads" ? "ROADS" : "EDGES";
  return `https://www2.census.gov/geo/tiger/TIGER${year}/${dir}/tl_${year}_${fips}_${layer}.zip`;
}

export function tigerWebExtentUrl(fips: string): string {
  const where = encodeURIComponent(`GEOID='${fips}'`);
  return `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=${where}&returnExtentOnly=true&outSR=4326&f=json`;
}

/** True when OUT would overwrite a committed overlay (not vocabs/generated/). */
export function isProtectedVocabPath(outPath: string, repoRoot: string): boolean {
  const generated = `${repoRoot.replace(/\\/g, "/")}/vocabs/generated/`;
  const normalized = outPath.replace(/\\/g, "/");
  if (normalized.startsWith(generated)) return false;
  return /\/vocabs\/[^/]+-en-US\.csv$/i.test(normalized);
}
