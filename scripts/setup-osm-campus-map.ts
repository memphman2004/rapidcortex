/**
 * Rapid Cortex — OSM Campus Map Setup
 *
 * Fetches campus buildings from OpenStreetMap (Overpass) and writes GeoJSON.
 * Default is DRY_RUN (print + optional local files). AWS S3/Dynamo writes are
 * opt-in and are not required — the live app serves OSM via Next.js BFF.
 *
 * Usage:
 *   CAMPUS=csu npx tsx scripts/setup-osm-campus-map.ts
 *   CAMPUS=csu CHECK_ONLY=1 npx tsx scripts/setup-osm-campus-map.ts
 *   CAMPUS=csu DRY_RUN=1 npx tsx scripts/setup-osm-campus-map.ts
 *   CAMPUS=csu UPLOAD=1 npx tsx scripts/setup-osm-campus-map.ts
 *
 * Does not install osmtogeojson or react-map-gl. Do not create public S3
 * buckets or DynamoDB tables from this script.
 */

import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  listCampusOsmKeys,
  resolveCampusOsmConfig,
} from "../apps/web/lib/campus/operational-map/campus-osm-registry.ts";
import {
  buildCampusOverpassQuery,
  campusOsmToBuildingGeoJSON,
  extractCampusOsmMarkers,
  summarizeCampusOsm,
  type OverpassResponse,
} from "../apps/web/lib/campus/operational-map/overpass-to-campus-geojson.ts";

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const url = (process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter").trim();
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);
  return (await resp.json()) as OverpassResponse;
}

async function main(): Promise<void> {
  const campusKey = process.env.CAMPUS?.trim();
  const dryRun = process.env.DRY_RUN !== "0";
  const checkOnly = process.env.CHECK_ONLY === "1";
  const upload = process.env.UPLOAD === "1";
  const bucket = process.env.VENUE_MAPS_BUCKET ?? "rc-venue-maps";
  const region = process.env.AWS_REGION ?? "us-east-1";

  if (!campusKey) {
    console.error("Usage: CAMPUS=csu npx tsx scripts/setup-osm-campus-map.ts");
    console.error(`Available: ${listCampusOsmKeys().join(", ").toLowerCase()}`);
    process.exit(1);
  }

  const config = resolveCampusOsmConfig(campusKey);
  if (!config) {
    console.error(`Unknown campus: ${campusKey}`);
    console.error(`Available: ${listCampusOsmKeys().join(", ").toLowerCase()}`);
    process.exit(1);
  }

  const mode = checkOnly ? "CHECK ONLY" : upload && !dryRun ? "UPLOAD" : "DRY RUN";
  console.log(`\nRC Campus Map Setup — ${config.campusName} (${mode})\n`);

  const osm = await fetchOverpass(buildCampusOverpassQuery(config));
  const summary = summarizeCampusOsm(osm);
  console.log(`  Buildings: ${summary.buildings} (${summary.named} named, ${summary.withLevels} with floors)`);
  console.log(`  AEDs: ${summary.aeds}  Emergency phones: ${summary.phones}`);

  if (checkOnly) {
    console.log("\nCHECK_ONLY — no files written.");
    return;
  }

  const geojson = campusOsmToBuildingGeoJSON(osm, config);
  const markers = extractCampusOsmMarkers(osm);
  const outDir = path.join(os.tmpdir(), "rc-campus-maps", config.campusId.toLowerCase());
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "buildings-exterior.geojson"), JSON.stringify(geojson, null, 2));
  await writeFile(path.join(outDir, "markers-osm.json"), JSON.stringify(markers, null, 2));
  console.log(`  Wrote ${geojson.features.length} buildings → ${outDir}`);

  if (upload) {
    const s3 = new S3Client({ region });
    const key = `${config.campusId.toLowerCase()}/buildings-exterior.geojson`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(geojson),
        ContentType: "application/json",
        CacheControl: "private, max-age=86400",
      }),
    );
    console.log(`  Uploaded s3://${bucket}/${key}`);
  } else {
    console.log("  Skip S3 (set UPLOAD=1 only after a private bucket exists).");
    console.log("  Live app loads OSM through GET /api/campus/code/:code/map/buildings");
  }
}

main().catch((err) => {
  console.error("\nError:", err instanceof Error ? err.message : err);
  process.exit(1);
});
