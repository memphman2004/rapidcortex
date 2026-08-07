#!/usr/bin/env npx tsx
/**
 * Rapid Cortex — PSAP Address Enrichment (AWS Location Service / Esri)
 *
 * Replaces Nominatim with AWS-native geocoding. Writes into the existing
 * nested `mailingAddress` shape used by PSAP Prospect CRM.
 *
 * Strategy per record:
 *   1. Has latitude/longitude → reverse geocode → fill mailingAddress
 *   2. No coords → forward geocode from name + city/county + state
 *   3. Already has mailingAddress.streetAddress → skip (unless --force)
 *
 * Usage:
 *   STAGE=dev npx tsx scripts/enrich-psap-addresses.ts --dry-run
 *   STAGE=dev npx tsx scripts/enrich-psap-addresses.ts --state=GA --limit=50
 *   STAGE=dev npx tsx scripts/enrich-psap-addresses.ts --force
 *   PSAP_PROSPECTS_TABLE=rapid-cortex-psap-prospects-dev npx tsx scripts/enrich-psap-addresses.ts
 *
 * Flags also accept space form: --state GA --limit 50
 *
 * Required AWS permissions:
 *   - dynamodb:Scan|Query|UpdateItem on rapid-cortex-psap-prospects-{STAGE}
 *   - geo:SearchPlaceIndexForPosition|SearchPlaceIndexForText|DescribePlaceIndex
 *   - geo:CreatePlaceIndex (only if index missing and not --dry-run)
 *
 * Cost (Esri, us-east-1): ~5,597 × $0.50/1000 ≈ $2.80 one-time.
 */

import {
  DynamoDBClient,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  LocationClient,
  SearchPlaceIndexForPositionCommand,
  SearchPlaceIndexForTextCommand,
  DescribePlaceIndexCommand,
  CreatePlaceIndexCommand,
} from "@aws-sdk/client-location";

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGE = process.env.STAGE ?? "dev";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const TABLE_NAME =
  process.env.PSAP_PROSPECTS_TABLE ?? `rapid-cortex-psap-prospects-${STAGE}`;
const PLACE_INDEX_NAME =
  process.env.PSAP_PLACE_INDEX ?? `rapid-cortex-psap-enrichment-${STAGE}`;

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const FORCE = argv.includes("--force");

function argValue(name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--")) return argv[i + 1];
  return undefined;
}

const STATE_FILTER = argValue("--state")?.toUpperCase();
const LIMIT_RAW = argValue("--limit");
const LIMIT = LIMIT_RAW ? parseInt(LIMIT_RAW, 10) : Number.POSITIVE_INFINITY;

const DELAY_MS = 25;
const MAX_RETRIES = 3;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const location = new LocationClient({ region: REGION });

// ─── Types ────────────────────────────────────────────────────────────────────

interface PsapRecord {
  psapId: string;
  psapName: string;
  city: string;
  county: string;
  state: string;
  fips?: string;
  latitude?: number;
  longitude?: number;
  mailingAddress?: {
    streetAddress?: string;
    city?: string;
    county?: string;
    state?: string;
    zip?: string;
    verified?: boolean;
    enrichedAt?: string;
    source?: string;
    formattedAddress?: string;
    confidence?: string;
  };
}

interface EnrichmentResult {
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  fipsCountyCode?: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
  source: "reverse_geocode" | "forward_geocode";
  confidence: "high" | "medium" | "low";
}

interface RunStats {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  noData: number;
  dryRun: number;
}

// ─── Place index ──────────────────────────────────────────────────────────────

async function ensurePlaceIndex(): Promise<void> {
  try {
    await location.send(new DescribePlaceIndexCommand({ IndexName: PLACE_INDEX_NAME }));
    console.log(`✓ Place index exists: ${PLACE_INDEX_NAME}`);
  } catch {
    console.log(`Creating place index: ${PLACE_INDEX_NAME}...`);
    await location.send(
      new CreatePlaceIndexCommand({
        IndexName: PLACE_INDEX_NAME,
        DataSource: "Esri",
        DataSourceConfiguration: { IntendedUse: "Storage" },
        Description: "Rapid Cortex PSAP address enrichment index",
        Tags: {
          App: "rapid-cortex",
          Stage: STAGE,
          Purpose: "psap-enrichment",
        },
      }),
    );
    console.log(`✓ Created place index: ${PLACE_INDEX_NAME}`);
    await sleep(3000);
  }
}

// ─── Geocode ──────────────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<EnrichmentResult | null> {
  try {
    const response = await location.send(
      new SearchPlaceIndexForPositionCommand({
        IndexName: PLACE_INDEX_NAME,
        Position: [lng, lat],
        MaxResults: 1,
        Language: "en",
      }),
    );

    const place = response.Results?.[0]?.Place;
    if (!place) return null;

    const streetNumber = place.AddressNumber ?? "";
    const street = place.Street ?? "";
    const streetAddress = [streetNumber, street].filter(Boolean).join(" ").trim() || undefined;

    return {
      streetAddress,
      city: place.Municipality ?? undefined,
      state: place.Region ?? undefined,
      zip: place.PostalCode ?? undefined,
      county: place.SubRegion ?? undefined,
      fipsCountyCode: extractFIPS(place),
      formattedAddress: place.Label ?? undefined,
      source: "reverse_geocode",
      confidence: streetAddress ? "high" : "medium",
    };
  } catch (err) {
    console.warn(`  Reverse geocode failed for [${lat}, ${lng}]:`, (err as Error).message);
    return null;
  }
}

async function forwardGeocode(
  name: string,
  city?: string,
  state?: string,
  county?: string,
): Promise<EnrichmentResult | null> {
  const query = [name, city, county ? `${county} County`.replace(/ County County$/i, " County") : undefined, state, "USA"]
    .filter(Boolean)
    .join(", ");

  try {
    const bbox = state ? getStateBbox(state) : undefined;
    const response = await location.send(
      new SearchPlaceIndexForTextCommand({
        IndexName: PLACE_INDEX_NAME,
        Text: query,
        FilterCountries: ["USA"],
        MaxResults: 1,
        Language: "en",
        ...(bbox ? { FilterBBox: bbox } : {}),
      }),
    );

    const place = response.Results?.[0]?.Place;
    if (!place) return null;

    const [lng, lat] = place.Geometry?.Point ?? [];
    if (lat === undefined || lng === undefined) return null;

    const streetNumber = place.AddressNumber ?? "";
    const street = place.Street ?? "";
    const streetAddress = [streetNumber, street].filter(Boolean).join(" ").trim() || undefined;

    return {
      lat,
      lng,
      streetAddress,
      city: place.Municipality ?? undefined,
      state: place.Region ?? undefined,
      zip: place.PostalCode ?? undefined,
      county: place.SubRegion ?? undefined,
      fipsCountyCode: extractFIPS(place),
      formattedAddress: place.Label ?? undefined,
      source: "forward_geocode",
      confidence: "medium",
    };
  } catch (err) {
    console.warn(`  Forward geocode failed for "${query}":`, (err as Error).message);
    return null;
  }
}

function extractFIPS(place: { SubRegionCode?: string }): string | undefined {
  const subRegionCode = place.SubRegionCode;
  if (subRegionCode && /^\d{5}$/.test(subRegionCode)) return subRegionCode;
  return undefined;
}

function needsEnrichment(record: PsapRecord): boolean {
  if (FORCE) return true;
  if (record.mailingAddress?.streetAddress?.trim()) return false;
  return true;
}

async function writeEnrichment(record: PsapRecord, result: EnrichmentResult): Promise<void> {
  const now = new Date().toISOString();
  const mailingAddress = {
    streetAddress: result.streetAddress ?? record.mailingAddress?.streetAddress,
    city: (result.city || record.mailingAddress?.city || record.city).trim(),
    county: (result.county || record.mailingAddress?.county || record.county).trim(),
    state: (
      (result.state?.length === 2 ? result.state : undefined) ||
      record.mailingAddress?.state ||
      record.state
    )
      .trim()
      .toUpperCase()
      .slice(0, 2),
    zip: result.zip ?? record.mailingAddress?.zip,
    verified: false,
    enrichedAt: now,
    source: "aws_location" as const,
    formattedAddress: result.formattedAddress,
    confidence: result.confidence,
  };

  if (!mailingAddress.streetAddress?.trim()) {
    throw new Error("No street address from geocode");
  }

  const exprNames: Record<string, string> = {
    "#mailingAddress": "mailingAddress",
    "#updatedAt": "updatedAt",
  };
  const exprValues: Record<string, unknown> = {
    ":mailingAddress": mailingAddress,
    ":updatedAt": now,
  };
  const sets = ["#mailingAddress = :mailingAddress", "#updatedAt = :updatedAt"];

  // Fill missing top-level fips when Esri returns SubRegionCode
  if (result.fipsCountyCode && (!record.fips?.trim() || FORCE)) {
    exprNames["#fips"] = "fips";
    exprValues[":fips"] = result.fipsCountyCode;
    sets.push("#fips = :fips");
  }

  // Fill missing coordinates from forward geocode only
  if (result.source === "forward_geocode") {
    if ((record.latitude === undefined || record.latitude === null) && result.lat !== undefined) {
      exprNames["#latitude"] = "latitude";
      exprValues[":latitude"] = result.lat;
      sets.push("#latitude = :latitude");
    }
    if ((record.longitude === undefined || record.longitude === null) && result.lng !== undefined) {
      exprNames["#longitude"] = "longitude";
      exprValues[":longitude"] = result.lng;
      sets.push("#longitude = :longitude");
    }
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { psapId: record.psapId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    }),
  );
}

async function listPage(
  exclusiveStartKey?: Record<string, AttributeValue>,
): Promise<{ items: PsapRecord[]; lastKey?: Record<string, AttributeValue> }> {
  if (STATE_FILTER) {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "StateUpdatedIndex",
        KeyConditionExpression: "#st = :st",
        ExpressionAttributeNames: { "#st": "state" },
        ExpressionAttributeValues: { ":st": STATE_FILTER },
        ExclusiveStartKey: exclusiveStartKey,
        Limit: 25,
      }),
    );
    return {
      items: (r.Items ?? []) as PsapRecord[],
      lastKey: r.LastEvaluatedKey as Record<string, AttributeValue> | undefined,
    };
  }

  const r = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: exclusiveStartKey,
      Limit: 25,
    }),
  );
  return {
    items: (r.Items ?? []) as PsapRecord[],
    lastKey: r.LastEvaluatedKey as Record<string, AttributeValue> | undefined,
  };
}

async function run(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Rapid Cortex — PSAP Address Enrichment (AWS Location / Esri)");
  console.log(`  Table:       ${TABLE_NAME}`);
  console.log(`  Region:      ${REGION}`);
  console.log(`  Place Index: ${PLACE_INDEX_NAME}`);
  console.log(`  Dry run:     ${DRY_RUN}`);
  console.log(`  Force:       ${FORCE}`);
  console.log(`  Limit:       ${Number.isFinite(LIMIT) ? LIMIT : "all"}`);
  console.log(`  State:       ${STATE_FILTER ?? "all"}`);
  console.log("─────────────────────────────────────────────────────────────");

  if (!DRY_RUN) {
    await ensurePlaceIndex();
  }

  const stats: RunStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    noData: 0,
    dryRun: 0,
  };

  let lastKey: Record<string, AttributeValue> | undefined;
  let processed = 0;

  do {
    const page = await listPage(lastKey);

    for (const record of page.items) {
      if (processed >= LIMIT) break;
      stats.total++;
      processed++;

      const logPrefix = `[${processed}] ${record.psapId} — ${record.psapName} (${record.state})`;

      if (!needsEnrichment(record)) {
        console.log(`${logPrefix}  ↻ skip (already has street address)`);
        stats.skipped++;
        continue;
      }

      let result: EnrichmentResult | null = null;

      if (record.latitude !== undefined && record.longitude !== undefined) {
        result = await reverseGeocode(record.latitude, record.longitude);
      }

      if (!result) {
        if (!record.state && !record.city && !record.county) {
          console.log(`${logPrefix}  ✗ skip (no coords, no address context)`);
          stats.noData++;
          continue;
        }
        result = await forwardGeocode(record.psapName, record.city, record.state, record.county);
      }

      if (!result?.streetAddress && !result?.formattedAddress) {
        console.log(`${logPrefix}  ✗ failed (geocode returned nothing useful)`);
        stats.failed++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`${logPrefix}  ✓ [DRY RUN]`);
        console.log(`     ${result.formattedAddress ?? result.streetAddress ?? "—"}`);
        console.log(
          `     FIPS: ${result.fipsCountyCode ?? "—"}  zip: ${result.zip ?? "—"}  source: ${result.source}`,
        );
        stats.dryRun++;
        await sleep(DELAY_MS);
        continue;
      }

      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          await writeEnrichment(record, result);
          console.log(`${logPrefix}  ✓ enriched [${result.source}] ${result.confidence}`);
          stats.enriched++;
          break;
        } catch (err) {
          retries++;
          if (retries === MAX_RETRIES) {
            console.error(
              `${logPrefix}  ✗ write failed after ${MAX_RETRIES} retries:`,
              (err as Error).message,
            );
            stats.failed++;
          } else {
            await sleep(500 * retries);
          }
        }
      }

      await sleep(DELAY_MS);
    }

    lastKey = page.lastKey;
    if (processed >= LIMIT) break;
  } while (lastKey);

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("  Enrichment Complete");
  console.log(`  Total scanned:  ${stats.total}`);
  console.log(`  Enriched:       ${stats.enriched}`);
  console.log(`  Skipped:        ${stats.skipped}`);
  console.log(`  No data:        ${stats.noData}`);
  console.log(`  Failed:         ${stats.failed}`);
  if (DRY_RUN) console.log(`  Dry run:        ${stats.dryRun}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  if (stats.failed > 0) {
    console.warn(
      `⚠  ${stats.failed} records failed. Retry with --state=XX --force for those states.`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** AWS Location FilterBBox: [minLng, minLat, maxLng, maxLat] */
function getStateBbox(state: string): [number, number, number, number] | undefined {
  const BBOXES: Record<string, [number, number, number, number]> = {
    AL: [-88.47, 30.14, -84.89, 35.01],
    AK: [-179.15, 51.22, -129.99, 71.41],
    AZ: [-114.82, 31.33, -109.05, 37.0],
    AR: [-94.62, 33.0, -89.64, 36.5],
    CA: [-124.41, 32.53, -114.13, 42.01],
    CO: [-109.06, 36.99, -102.04, 41.0],
    CT: [-73.73, 40.98, -71.79, 42.05],
    DE: [-75.79, 38.45, -75.05, 39.84],
    FL: [-87.63, 24.52, -80.03, 31.0],
    GA: [-85.61, 30.36, -80.84, 35.0],
    HI: [-160.25, 18.91, -154.81, 22.24],
    ID: [-117.24, 41.99, -111.04, 49.0],
    IL: [-91.51, 36.97, -87.02, 42.51],
    IN: [-88.1, 37.77, -84.78, 41.76],
    IA: [-96.64, 40.38, -90.14, 43.5],
    KS: [-102.05, 36.99, -94.59, 40.0],
    KY: [-89.57, 36.5, -81.96, 39.15],
    LA: [-94.04, 28.92, -88.82, 33.02],
    ME: [-71.08, 43.06, -66.95, 47.46],
    MD: [-79.49, 37.91, -75.05, 39.72],
    MA: [-73.51, 41.24, -69.93, 42.89],
    MI: [-90.42, 41.7, -82.41, 48.19],
    MN: [-97.24, 43.5, -89.49, 49.38],
    MS: [-91.66, 30.17, -88.1, 35.01],
    MO: [-95.77, 35.99, -89.1, 40.61],
    MT: [-116.05, 44.36, -104.04, 49.0],
    NE: [-104.05, 39.99, -95.31, 43.0],
    NV: [-120.0, 35.0, -114.04, 42.0],
    NH: [-72.56, 42.7, -70.7, 45.31],
    NJ: [-75.56, 38.92, -73.89, 41.36],
    NM: [-109.05, 31.33, -103.0, 37.0],
    NY: [-79.76, 40.5, -71.86, 45.02],
    NC: [-84.32, 33.84, -75.46, 36.59],
    ND: [-104.05, 45.94, -96.55, 49.0],
    OH: [-84.82, 38.4, -80.52, 41.98],
    OK: [-103.0, 33.62, -94.43, 37.0],
    OR: [-124.57, 41.99, -116.46, 46.26],
    PA: [-80.52, 39.72, -74.69, 42.27],
    RI: [-71.9, 41.15, -71.12, 42.02],
    SC: [-83.36, 32.04, -78.54, 35.22],
    SD: [-104.06, 42.48, -96.44, 45.94],
    TN: [-90.31, 34.98, -81.65, 36.68],
    TX: [-106.65, 25.84, -93.51, 36.5],
    UT: [-114.05, 36.99, -109.04, 42.0],
    VT: [-73.44, 42.73, -71.46, 45.02],
    VA: [-83.68, 36.54, -75.24, 39.46],
    WA: [-124.73, 45.54, -116.92, 49.0],
    WV: [-82.64, 37.2, -77.72, 40.64],
    WI: [-92.89, 42.49, -86.25, 47.31],
    WY: [-111.06, 40.99, -104.05, 45.01],
    DC: [-77.12, 38.79, -76.91, 38.99],
  };
  return BBOXES[state];
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
