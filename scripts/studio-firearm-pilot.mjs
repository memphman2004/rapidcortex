/**
 * Controlled 10-image studio pilot. Does not train a model and does not
 * approve any candidate. Refuses to run unless STUDIO_PILOT_CONFIRM=1.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";

const ESTIMATE_USD = 0.4;
const TABLE = "rapid-cortex-vision-events-dev";
const BUCKET = "rapid-cortex-vision-artifacts-dev-158961537080";
const BATCH_ID = "firearm-like-pilot-10";
const MODEL = "gpt-image-2.5-flare";

const SPECS = [
  ["01", "positive", "standard", "day", "overhead", "none", "Overhead security-camera view of an empty concrete parking-garage lane in daylight. A dark handheld object with a pistol-like silhouette lies on the concrete. No people, no faces, no text, and no logo."],
  ["02", "positive", "standard", "day", "doorway", "none", "Doorway security-camera view of an empty tiled corridor in daylight. A dark pistol-like silhouette rests on the floor near the wall. No people, no faces, no text, and no logo."],
  ["03", "positive", "standard", "day", "overhead", "none", "Overhead daylight view of an empty loading dock. A long firearm-like silhouette lies on concrete. No people, no faces, no text, and no logo."],
  ["04", "positive", "standard", "day", "corridor", "none", "Corridor security camera, daylight, empty hallway. A compact pistol-like shape sits on a bench. No people, no faces, no text, and no logo."],
  ["05", "negative", "standard", "day", "overhead", "none", "Overhead security-camera view of an empty parking garage. A cordless drill lies on the concrete. No people, no faces, no text, and no logo."],
  ["06", "negative", "standard", "day", "doorway", "none", "Doorway camera, empty corridor, daylight. A mobile phone lies on the floor. No people, no faces, no text, and no logo."],
  ["07", "negative", "standard", "day", "overhead", "none", "Overhead daylight view of an empty workshop floor. A hair dryer lies on the concrete. No people, no faces, no text, and no logo."],
  ["08", "negative", "standard", "day", "corridor", "none", "Corridor camera, empty hallway, daylight. A tape measure lies on the floor. No people, no faces, no text, and no logo."],
  ["09", "positive", "challenging", "low", "overhead", "partial", "Low-light overhead security camera in an empty parking garage. A pistol-like silhouette is partly hidden behind a concrete column. No people, no faces, no text, and no logo."],
  ["10", "negative", "challenging", "low", "doorway", "partial", "Low-light doorway camera in an empty corridor. A cordless drill is partly blocked by a trash bin. No people, no faces, no text, and no logo."],
];

if (process.env.STUDIO_PILOT_CONFIRM !== "1") {
  console.log(`Planner estimate $${ESTIMATE_USD.toFixed(2)} for 10 low-quality images on ${MODEL}. No image was requested. Set STUDIO_PILOT_CONFIRM=1 to run the pilot.`);
  process.exit(0);
}

const secrets = new SecretsManagerClient({ region: "us-east-1" });
const secret = await secrets.send(new GetSecretValueCommand({ SecretId: "rapid-cortex/ai/openai" }));
const parsed = JSON.parse(secret.SecretString ?? "{}");
const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
if (!apiKey.startsWith("sk-")) {
  console.error("The studio secret did not contain a usable key field. No image was requested.");
  process.exit(1);
}

const client = new OpenAI({ apiKey });
const s3 = new S3Client({ region: "us-east-1" });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
const created = [];
let imageOutputTokens = 0;

for (const [index, role, difficulty, lighting, cameraAngle, occlusion, prompt] of SPECS) {
  const id = `firearm-pilot-10-${index}`;
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: { pk: "STUDIO#rc-admin", sk: `REVIEW#${id}` } }));
  if (existing.Item) {
    created.push({ id, skipped: true });
    continue;
  }
  const image = await client.images.generate({ model: MODEL, prompt, n: 1, size: "1024x1024", quality: "low" });
  const b64 = image.data?.[0]?.b64_json;
  if (!b64) throw new Error(`Image ${id} returned no bytes. Later images were not requested.`);
  imageOutputTokens += image.usage?.output_tokens ?? 0;
  const key = `studio/synthetic/${BATCH_ID}/${index}.png`;
  const bytes = Buffer.from(b64, "base64");
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: "image/png" }));
  const now = new Date().toISOString();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: "STUDIO#rc-admin",
      sk: `REVIEW#${id}`,
      gsi1pk: "STUDIO#rc-admin#STATUS#REVIEW_REQUIRED",
      gsi1sk: `${now}#${id}`,
      recordType: "studio_review",
      id,
      kind: "synthetic-image",
      status: "REVIEW_REQUIRED",
      approved: false,
      trainingLabel: false,
      modelId: MODEL,
      category: "firearm_like",
      createdAt: now,
      synthetic: true,
      rightsStatus: "synthetic_internal",
      prompt,
      s3Key: key,
      lighting,
      cameraAngle,
      occlusion,
      objectSize: "medium",
      role,
      difficulty,
      sourceType: "synthetic",
      batchId: BATCH_ID,
      distance: "medium",
    },
    ConditionExpression: "attribute_not_exists(pk)",
  }));
  created.push({ id, bytes: bytes.length, role, difficulty });
}

console.log(JSON.stringify({
  model: MODEL,
  estimateUsd: ESTIMATE_USD,
  imageOutputTokens,
  created,
  approved: false,
  trainingStarted: false,
  liveDetection: "disabled",
}, null, 2));
