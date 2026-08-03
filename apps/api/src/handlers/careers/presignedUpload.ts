/**
 * Public careers resume upload — POST /api/careers/presigned-upload (Authorizer NONE).
 * Browser PUTs the file directly to S3; Lambda never sees the bytes.
 */
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { careersPresignedUploadBodySchema } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";

const s3 = new S3Client({});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function json(body: object, statusCode = 200) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return withCorrelationHeaders(event, { statusCode: 204, headers: CORS, body: "" });
  }
  if (event.requestContext.http.method !== "POST") {
    return withCorrelationHeaders(event, json({ error: "Method not allowed" }, 405));
  }
  if (!env.enableHiring) {
    return withCorrelationHeaders(event, json({ error: "Feature is not available" }, 503));
  }

  const bucket = env.resumesBucket;
  if (!bucket) {
    console.error(JSON.stringify({ msg: "careers_presign_error", error: "RESUMES_BUCKET not set" }));
    return withCorrelationHeaders(event, json({ error: "Service unavailable" }, 500));
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(event.body ?? "{}");
  } catch {
    return withCorrelationHeaders(event, json({ error: "Invalid JSON" }, 400));
  }

  const parsed = careersPresignedUploadBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return withCorrelationHeaders(
      event,
      json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400),
    );
  }

  const { fileName, contentType } = parsed.data;
  const ext = EXT[contentType] ?? "bin";
  const year = new Date().getUTCFullYear();
  const resumeKey = `resumes/${year}/${randomUUID()}.${ext}`;

  try {
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: resumeKey,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
      { expiresIn: 300 },
    );

    return withCorrelationHeaders(
      event,
      json({ uploadUrl, resumeKey, fileName }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "careers_presign_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, json({ error: "Failed to create upload URL" }, 500));
  }
};
