/**
 * Generate an Amazon Transcribe custom vocabulary CSV for a PSAP at onboarding.
 *
 * Pulls street names from Census TIGER/Line (county edges/roads) and OSM,
 * merges them with the baseline public-safety list, and writes a CSV the
 * seed script can upload.
 *
 * Usage:
 *   COUNTY_FIPS=29095 AGENCY_ID=kcpd npx tsx scripts/generate-transcribe-vocab.ts
 *   COUNTY_FIPS=29095,29047 AGENCY_ID=kcpd npx tsx scripts/generate-transcribe-vocab.ts
 *
 * This does not use Amazon Location API keys. Map tile keys (e.g. rc-map-prod)
 * have no Places/Routes access and are unrelated to street-name extraction.
 *
 * Env:
 *   COUNTY_FIPS     Required. 5-digit county FIPS, comma-separated for multi-county.
 *   AGENCY_ID       Required. Output file stem (kcpd → kcpd-en-US.csv).
 *   TIGER_YEAR      Default 2024. Falls back to 2023 on HTTP 404.
 *   TIGER_LAYER     edges (default) or roads.
 *   SKIP_TIGER=1    OSM only.
 *   SKIP_OSM=1      TIGER only.
 *   OVERPASS_API_URL  Default https://overpass-api.de/api/interpreter
 *   OUT             Output CSV path. Default vocabs/generated/${AGENCY_ID}-en-US.csv
 *   FORCE=1         Allow overwriting a committed vocabs/${AGENCY_ID}-en-US.csv overlay.
 *   MAX_PHRASES     Default 45000 (Transcribe Phrases array cap is 50000).
 *   SKIP_CACHE=1    Re-download TIGER zips.
 *   TIGER_DBF       Local .dbf path (skips TIGER download).
 *   OSM_JSON        Local Overpass JSON path (skips OSM fetch).
 *   INCLUDE_OVERLAY=0  Do not merge vocabs/${AGENCY_ID}-en-US.csv
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_PHRASES,
  bboxFromTigerWebExtent,
  buildOverpassStreetQuery,
  capVocabEntries,
  fullnamesFromDbfRecords,
  getBasePublicSafetyVocab,
  isProtectedVocabPath,
  parseCountyFipsList,
  parseVocabCsv,
  readDbfRecords,
  sanitizeAgencyId,
  streetNamesFromOverpass,
  streetsToEntries,
  tigerWebExtentUrl,
  tigerZipUrl,
  toVocabCsv,
  unionBboxes,
  type CountyBbox,
  type VocabEntry,
} from "./lib/transcribe-vocab.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER_AGENT = "RapidCortex-TranscribeVocab/1.0 (agency-onboarding; https://rapidcortex.us)";
const TIGER_YEARS_FALLBACK = [2024, 2023];
const OVERPASS_FALLBACKS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(`
Usage:
  COUNTY_FIPS=29095 AGENCY_ID=kcpd npx tsx scripts/generate-transcribe-vocab.ts

Writes vocabs/generated/\${AGENCY_ID}-en-US.csv (gitignored). Does not overwrite
the committed overlay at vocabs/\${AGENCY_ID}-en-US.csv unless FORCE=1 and OUT points there.
`);
  process.exit(1);
}

async function fetchBuffer(url: string, timeoutMs: number): Promise<{ status: number; body: Buffer }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  const body = Buffer.from(await res.arrayBuffer());
  return { status: res.status, body };
}

async function fetchJson(url: string, timeoutMs: number, init?: RequestInit): Promise<unknown> {
  const { headers: initHeaders, ...rest } = init ?? {};
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
    ...rest,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(initHeaders as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`${rest.method ?? "GET"} ${url} → ${res.status}`);
  }
  return res.json();
}

function extractDbfFromZip(zipPath: string, destDir: string): string {
  mkdirSync(destDir, { recursive: true });
  const py = `
import zipfile, pathlib, sys
zpath, dest = sys.argv[1], pathlib.Path(sys.argv[2])
dest.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(zpath) as z:
    name = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
    out = dest / pathlib.Path(name).name
    out.write_bytes(z.read(name))
    print(out)
`;
  const pyResult = spawnSync("python3", ["-c", py, zipPath, destDir], { encoding: "utf8" });
  if (pyResult.status === 0) {
    const out = pyResult.stdout.trim().split("\n").pop()?.trim();
    if (out && existsSync(out)) return out;
  }

  const unzip = spawnSync("unzip", ["-o", "-j", zipPath, "*.dbf", "-d", destDir], { encoding: "utf8" });
  if (unzip.status === 0) {
    const listed = spawnSync("unzip", ["-Z", "-1", zipPath], { encoding: "utf8" });
    const dbfName = (listed.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .find((n) => n.toLowerCase().endsWith(".dbf"));
    if (dbfName) {
      const extracted = join(destDir, dbfName.split("/").pop()!);
      if (existsSync(extracted)) return extracted;
    }
  }

  const pyErr = (pyResult.stderr || pyResult.stdout || "").trim();
  const unzipErr = (unzip.stderr || unzip.stdout || "").trim();
  throw new Error(`Failed to extract .dbf from ${zipPath}. python3: ${pyErr || pyResult.status}; unzip: ${unzipErr || unzip.status}`);
}

async function downloadTigerZip(fips: string, year: number, layer: "edges" | "roads", cacheDir: string): Promise<string> {
  const url = tigerZipUrl(fips, year, layer);
  const zipPath = join(cacheDir, `tl_${year}_${fips}_${layer}.zip`);
  if (existsSync(zipPath) && !envFlag("SKIP_CACHE")) {
    console.log(`Using cached ${zipPath}`);
    return zipPath;
  }
  console.log(`Fetching ${url}`);
  const { status, body } = await fetchBuffer(url, 180_000);
  if (status === 404) {
    const err = new Error(`TIGER zip not found: ${url}`);
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  if (status < 200 || status >= 300) {
    throw new Error(`TIGER download failed ${status}: ${url}`);
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(zipPath, body);
  return zipPath;
}

async function loadTigerStreets(
  fipsList: string[],
  yearHint: number,
  layer: "edges" | "roads",
  cacheDir: string,
): Promise<string[]> {
  const localDbf = process.env.TIGER_DBF?.trim();
  if (localDbf) {
    const records = readDbfRecords(readFileSync(resolve(localDbf)));
    return fullnamesFromDbfRecords(records);
  }

  const years = [yearHint, ...TIGER_YEARS_FALLBACK.filter((y) => y !== yearHint)];
  const names: string[] = [];
  for (const fips of fipsList) {
    let zipPath: string | undefined;
    let lastErr: unknown;
    for (const year of years) {
      try {
        zipPath = await downloadTigerZip(fips, year, layer, cacheDir);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number }).status;
        if (status === 404) {
          console.warn(`No TIGER ${year} ${layer} for ${fips}; trying next year…`);
          continue;
        }
        throw err;
      }
    }
    if (!zipPath) {
      throw lastErr instanceof Error ? lastErr : new Error(`TIGER download failed for ${fips}`);
    }
    const dbfPath = extractDbfFromZip(zipPath, join(cacheDir, `${fips}_${layer}`));
    const records = readDbfRecords(readFileSync(dbfPath));
    const extracted = fullnamesFromDbfRecords(records);
    console.log(`  FIPS ${fips}: ${extracted.length} named TIGER ${layer} records`);
    names.push(...extracted);
  }
  return names;
}

async function getCountyBoundingBox(fips: string): Promise<CountyBbox> {
  const json = await fetchJson(tigerWebExtentUrl(fips), 60_000);
  return bboxFromTigerWebExtent(json);
}

async function queryOSMStreets(bbox: CountyBbox): Promise<string[]> {
  const localJson = process.env.OSM_JSON?.trim();
  if (localJson) {
    const payload = JSON.parse(readFileSync(resolve(localJson), "utf8")) as unknown;
    return streetNamesFromOverpass(payload);
  }

  const query = buildOverpassStreetQuery(bbox);
  const configured = process.env.OVERPASS_API_URL?.trim();
  const endpoints = configured ? [configured, ...OVERPASS_FALLBACKS.filter((u) => u !== configured)] : OVERPASS_FALLBACKS;

  let lastErr: unknown;
  for (const url of endpoints) {
    try {
      console.log(`Querying OSM Overpass (${url})…`);
      const payload = await fetchJson(url, 180_000, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
      });
      return streetNamesFromOverpass(payload);
    } catch (err) {
      lastErr = err;
      console.warn(`Overpass failed at ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass query failed");
}

function loadOptionalCsv(path: string, label: string): VocabEntry[] {
  if (!existsSync(path)) return [];
  const rows = parseVocabCsv(readFileSync(path, "utf8"));
  console.log(`Loaded ${rows.length} ${label} from ${path}`);
  return rows;
}

async function generateVocabulary(): Promise<void> {
  const fipsRaw = process.env.COUNTY_FIPS?.trim() ?? "";
  const agencyRaw = process.env.AGENCY_ID?.trim() ?? "";
  if (!fipsRaw || !agencyRaw) {
    usage("COUNTY_FIPS and AGENCY_ID are required.");
  }

  const fipsList = parseCountyFipsList(fipsRaw);
  const agencyId = sanitizeAgencyId(agencyRaw);
  const language = process.env.VOCAB_LANGUAGE_CODE?.trim() || "en-US";
  const layer = (process.env.TIGER_LAYER?.trim().toLowerCase() === "roads" ? "roads" : "edges") as "edges" | "roads";
  const yearHint = Number.parseInt(process.env.TIGER_YEAR?.trim() || "2024", 10);
  const maxPhrases = Number.parseInt(process.env.MAX_PHRASES?.trim() || String(DEFAULT_MAX_PHRASES), 10);
  const cacheDir = join(ROOT, "vocabs", ".cache");
  const skipTiger = envFlag("SKIP_TIGER");
  const skipOsm = envFlag("SKIP_OSM");

  const outPath = resolve(process.env.OUT?.trim() || join(ROOT, "vocabs", "generated", `${agencyId}-${language}.csv`));
  if (existsSync(outPath) && isProtectedVocabPath(outPath, ROOT) && !envFlag("FORCE")) {
    usage(
      `Refusing to overwrite committed overlay ${outPath}. Write to vocabs/generated/ (default) or set FORCE=1.`,
    );
  }

  console.log(`Agency ${agencyId} · FIPS ${fipsList.join(",")} · TIGER ${layer}`);

  let tigerNames: string[] = [];
  if (!skipTiger) {
    console.log(`Fetching TIGER/Line ${layer} for county FIPS ${fipsList.join(", ")}…`);
    tigerNames = await loadTigerStreets(fipsList, yearHint, layer, cacheDir);
  } else {
    console.log("SKIP_TIGER=1 — not downloading Census shapefiles.");
  }

  let osmNames: string[] = [];
  if (!skipOsm) {
    try {
      const boxes = await Promise.all(fipsList.map((fips) => getCountyBoundingBox(fips)));
      const bbox = unionBboxes(boxes);
      osmNames = await queryOSMStreets(bbox);
      console.log(`OSM named highways: ${osmNames.length}`);
    } catch (err) {
      console.warn(`OSM lookup failed (continuing with TIGER only): ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.log("SKIP_OSM=1 — not querying Overpass.");
  }

  const streetEntries = streetsToEntries([...tigerNames, ...osmNames]);
  console.log(`Unique street names after filter: ${streetEntries.length}`);

  const baseVocab = getBasePublicSafetyVocab();
  const baselinePath = process.env.BASELINE_VOCAB_FILE?.trim() || join(ROOT, "vocabs", "baseline-en-US.csv");
  const baseline = loadOptionalCsv(baselinePath, "baseline phrases");
  const overlayPath = join(ROOT, "vocabs", `${agencyId}-${language}.csv`);
  const overlay =
    process.env.INCLUDE_OVERLAY === "0" ? [] : loadOptionalCsv(overlayPath, "agency overlay");

  const reserved = [...baseVocab, ...baseline, ...overlay];
  const { entries, truncated } = capVocabEntries(reserved, streetEntries, maxPhrases);
  if (truncated > 0) {
    console.warn(`Truncated ${truncated} street names to stay under MAX_PHRASES=${maxPhrases}.`);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, toVocabCsv(entries));
  console.log(`Generated ${entries.length} vocabulary entries → ${outPath}`);
  console.log("Unusual pronunciations still need manual review (SoundsLike column).");
  console.log(
    `Next: AGENCY_ID=${agencyId} VOCAB_FILE=${outPath} npx tsx scripts/seed-agency-transcribe-vocab.ts`,
  );
}

generateVocabulary().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
