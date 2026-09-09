import { describe, expect, it } from "vitest";
import {
  SKIP_PATTERNS,
  bboxFromTigerWebExtent,
  buildOverpassStreetQuery,
  capVocabEntries,
  filterStreetNames,
  fullnamesFromDbfRecords,
  getBasePublicSafetyVocab,
  isProtectedVocabPath,
  mergeVocabEntries,
  parseCountyFipsList,
  parseVocabCsv,
  readDbfRecords,
  sanitizeAgencyId,
  sanitizePhrase,
  streetNamesFromOverpass,
  streetsToEntries,
  tigerZipUrl,
  toVocabCsv,
  unionBboxes,
} from "./lib/transcribe-vocab.ts";

function buildDbf(rows: Array<{ FULLNAME: string; MTFCC: string }>): Buffer {
  const fields = [
    { name: "FULLNAME", len: 40 },
    { name: "MTFCC", len: 5 },
  ];
  const recordLen = 1 + fields.reduce((sum, f) => sum + f.len, 0);
  const headerLen = 32 + fields.length * 32 + 1;
  const buf = Buffer.alloc(headerLen + recordLen * rows.length);
  buf[0] = 0x03;
  buf.writeUInt32LE(rows.length, 4);
  buf.writeUInt16LE(headerLen, 8);
  buf.writeUInt16LE(recordLen, 10);
  let fieldOffset = 32;
  for (const field of fields) {
    buf.write(field.name, fieldOffset, "ascii");
    buf[fieldOffset + 11] = 0x43;
    buf[fieldOffset + 16] = field.len;
    fieldOffset += 32;
  }
  buf[fieldOffset] = 0x0d;
  let pos = headerLen;
  for (const row of rows) {
    buf[pos] = 0x20;
    buf.write(row.FULLNAME.padEnd(40).slice(0, 40), pos + 1, "latin1");
    buf.write(row.MTFCC.padEnd(5).slice(0, 5), pos + 1 + 40, "ascii");
    pos += recordLen;
  }
  return buf;
}

describe("generate-transcribe-vocab helpers", () => {
  it("parses 5-digit county FIPS lists", () => {
    expect(parseCountyFipsList("29095")).toEqual(["29095"]);
    expect(parseCountyFipsList("29095,29047 29165")).toEqual(["29095", "29047", "29165"]);
    expect(() => parseCountyFipsList("29")).toThrow(/5 digits/);
  });

  it("sanitizes agency ids and Transcribe phrases", () => {
    expect(sanitizeAgencyId("KCPD")).toBe("kcpd");
    expect(sanitizePhrase("Troost  Avenue,")).toBe("Troost Avenue");
    expect(sanitizePhrase("I–70")).toBe("I-70");
    expect(() => sanitizeAgencyId("../etc")).toThrow(/AGENCY_ID/);
  });

  it("skips generic and already-known street patterns", () => {
    expect(SKIP_PATTERNS.test("Main Street")).toBe(true);
    expect(SKIP_PATTERNS.test("North Oak Avenue")).toBe(true);
    expect(SKIP_PATTERNS.test("Troost Avenue")).toBe(false);
    expect(filterStreetNames(["Main Street", "Street", "Troost Avenue", "E 63rd St", "ab"])).toEqual([
      "E 63rd St",
      "Troost Avenue",
    ]);
  });

  it("includes the onboarding public-safety base list", () => {
    const phrases = getBasePublicSafetyVocab().map((e) => e.Phrase);
    expect(phrases).toEqual(
      expect.arrayContaining(["BOLO", "PSAP", "welfare check", "catalytic converter", "northbound"]),
    );
  });

  it("merges layers case-insensitively with later SoundsLike winning", () => {
    const merged = mergeVocabEntries([
      [{ Phrase: "Paseo", DisplayAs: "Paseo" }],
      [{ Phrase: "paseo", SoundsLike: "puh-say-oh", DisplayAs: "Paseo" }],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.SoundsLike).toBe("puh-say-oh");
  });

  it("caps street names after reserved phrases", () => {
    const reserved = getBasePublicSafetyVocab();
    const streets = streetsToEntries(["A St", "Troost Avenue", "Country Club Plaza"]);
    const { entries, truncated } = capVocabEntries(reserved, streets, reserved.length + 1);
    expect(truncated).toBe(2);
    expect(entries.some((e) => e.Phrase === "Country Club Plaza")).toBe(true);
    expect(entries.some((e) => e.Phrase === "BOLO")).toBe(true);
    expect(entries.some((e) => e.Phrase === "A St")).toBe(false);
  });

  it("round-trips Transcribe CSV including the IPA column", () => {
    const csv = toVocabCsv([
      { Phrase: "Troost", SoundsLike: "troost", DisplayAs: "Troost" },
      { Phrase: "BOLO", DisplayAs: "BOLO" },
    ]);
    expect(csv.startsWith("Phrase,SoundsLike,IPA,DisplayAs\n")).toBe(true);
    const parsed = parseVocabCsv(csv);
    expect(parsed.map((r) => r.Phrase)).toEqual(["Troost", "BOLO"]);
    expect(parsed[0]?.SoundsLike).toBe("troost");
  });

  it("extracts FULLNAME from TIGER road edges and skips rail", () => {
    const buf = buildDbf([
      { FULLNAME: "N Troost Ave", MTFCC: "S1400" },
      { FULLNAME: "BNSF RR", MTFCC: "R1011" },
      { FULLNAME: "", MTFCC: "S1400" },
    ]);
    const names = fullnamesFromDbfRecords(readDbfRecords(buf));
    expect(names).toEqual(["N Troost Ave"]);
  });

  it("parses Overpass tags, alt names, and highway refs", () => {
    const names = streetNamesFromOverpass({
      elements: [
        { tags: { highway: "primary", name: "Troost Avenue", alt_name: "The Paseo" } },
        { tags: { highway: "motorway", name: "I-70", ref: "I 70" } },
        { tags: { highway: "residential" } },
      ],
    });
    expect(names).toEqual(expect.arrayContaining(["Troost Avenue", "The Paseo", "I-70", "I-70"]));
  });

  it("builds a TigerWeb bbox and Overpass query", () => {
    const box = bboxFromTigerWebExtent({
      extent: { xmin: -94.6, ymin: 38.8, xmax: -94.2, ymax: 39.3 },
    });
    const union = unionBboxes([box, { south: 39.0, west: -94.8, north: 39.4, east: -94.1 }]);
    expect(union.west).toBe(-94.8);
    expect(union.north).toBe(39.4);
    expect(buildOverpassStreetQuery(box)).toContain("38.8,-94.6,39.3,-94.2");
    expect(tigerZipUrl("29095", 2024, "edges")).toBe(
      "https://www2.census.gov/geo/tiger/TIGER2024/EDGES/tl_2024_29095_edges.zip",
    );
  });

  it("protects committed overlay paths but not vocabs/generated", () => {
    const root = "/repo";
    expect(isProtectedVocabPath("/repo/vocabs/kcpd-en-US.csv", root)).toBe(true);
    expect(isProtectedVocabPath("/repo/vocabs/generated/kcpd-en-US.csv", root)).toBe(false);
  });
});
