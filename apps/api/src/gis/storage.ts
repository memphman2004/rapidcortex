import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { gisS3Prefix } from "rapid-cortex-shared";

const s3 = new S3Client({});

function bucket(): string {
  const b = process.env.ASSETS_BUCKET?.trim();
  if (!b) throw new Error("ASSETS_BUCKET is not configured");
  return b;
}

export function normalizedGeoJsonKey(agencyId: string, datasetId: string): string {
  return `${gisS3Prefix(agencyId, datasetId)}normalized.geojson`;
}

export async function putNormalizedGeoJson(
  agencyId: string,
  datasetId: string,
  fc: GeoJSON.FeatureCollection,
): Promise<string> {
  const key = normalizedGeoJsonKey(agencyId, datasetId);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: JSON.stringify(fc),
      ContentType: "application/geo+json",
      ServerSideEncryption: "AES256",
    }),
  );
  return key;
}

export async function getNormalizedGeoJson(
  agencyId: string,
  datasetId: string,
): Promise<GeoJSON.FeatureCollection | null> {
  const key = normalizedGeoJsonKey(agencyId, datasetId);
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const text = await res.Body?.transformToString();
    if (!text) return null;
    return JSON.parse(text) as GeoJSON.FeatureCollection;
  } catch {
    return null;
  }
}

/** 15-minute presigned GET for authenticated map clients (tenant-scoped key). */
export async function presignNormalizedGeoJson(
  agencyId: string,
  datasetId: string,
  expiresInSec = 900,
): Promise<string> {
  const key = normalizedGeoJsonKey(agencyId, datasetId);
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSec },
  );
}
