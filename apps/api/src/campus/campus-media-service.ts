import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { makeId } from "../lib/ids.js";

const s3 = new S3Client({});

function mediaBucket(): string {
  return process.env.ASSETS_BUCKET?.trim() ?? "";
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadReportPhoto(
  photoDataUrl: string,
  campusCode: string,
  incidentId: string,
): Promise<string> {
  const bucket = mediaBucket();
  if (!bucket) throw new Error("ASSETS_BUCKET not configured");

  const match = photoDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) throw new Error("INVALID_DATA_URL");

  const mimeType = match[1];
  const base64 = match[2];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error(`INVALID_MIME:${mimeType}`);
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const ext = mimeType.split("/")[1];
  const key = `campus/${campusCode}/incidents/${incidentId}/${makeId("photo")}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
      Metadata: {
        campusCode,
        incidentId,
        uploadedAt: new Date().toISOString(),
      },
    }),
  );

  return `s3://${bucket}/${key}`;
}
