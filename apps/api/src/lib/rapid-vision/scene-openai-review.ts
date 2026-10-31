import { z } from "zod";
import { createVisionJsonResponse } from "../rapid-iq/openai-client.js";

const SCENE_REVIEW_INSTRUCTIONS = [
  "You review selected still frames for Scene Intelligence.",
  "Describe only what is visible in the frames.",
  "A firearm-like shape is not a verified threat.",
  "An officer's own firearm is not a suspected crime.",
  "Do not infer identity, role, or criminal intent.",
  "If an object is unclear, use category UNKNOWN and uncertainty INSUFFICIENT_EVIDENCE.",
  "requiresHumanReview must be true.",
].join(" ");

const reviewSchema = z.object({
  eventId: z.string().min(1),
  cameraId: z.string().min(1),
  category: z.enum([
    "FIREARM_LIKE_OBJECT",
    "BLADE_LIKE_OBJECT",
    "POSSIBLE_ALTERCATION",
    "PERSON_DOWN",
    "POSSIBLE_COLLISION",
    "RESTRICTED_ENTRY",
    "OTHER",
    "UNKNOWN",
  ]),
  possibleObjectPresent: z.boolean(),
  description: z.string().min(1),
  visibleEvidence: z.array(z.string()),
  alternativeExplanations: z.array(z.string()),
  uncertainty: z.enum(["LOW", "MODERATE", "HIGH", "INSUFFICIENT_EVIDENCE"]),
  requiresHumanReview: z.literal(true),
  modelId: z.string().min(1),
}).strict();

export type SceneVisualReview = z.infer<typeof reviewSchema>;

const JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["eventId", "cameraId", "category", "possibleObjectPresent", "description", "visibleEvidence", "alternativeExplanations", "uncertainty", "requiresHumanReview", "modelId"],
  properties: {
    eventId: { type: "string" },
    cameraId: { type: "string" },
    category: { type: "string", enum: ["FIREARM_LIKE_OBJECT", "BLADE_LIKE_OBJECT", "POSSIBLE_ALTERCATION", "PERSON_DOWN", "POSSIBLE_COLLISION", "RESTRICTED_ENTRY", "OTHER", "UNKNOWN"] },
    possibleObjectPresent: { type: "boolean" },
    description: { type: "string" },
    visibleEvidence: { type: "array", items: { type: "string" } },
    alternativeExplanations: { type: "array", items: { type: "string" } },
    uncertainty: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "INSUFFICIENT_EVIDENCE"] },
    requiresHumanReview: { type: "boolean", const: true },
    modelId: { type: "string" },
  },
};

function reviewEnabled(): boolean {
  const raw = process.env.SCENE_OPENAI_REVIEW_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

function allowedFrame(url: string): boolean {
  if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "upload.wikimedia.org";
  } catch {
    return false;
  }
}

export function parseSceneVisualReview(raw: unknown): { ok: true; review: SceneVisualReview } | { ok: false; reason: string } {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "The model response did not match the review schema." };
  return { ok: true, review: parsed.data };
}

export async function reviewSceneFrames(input: {
  eventId: string;
  cameraId: string;
  frames: string[];
  agencyTransferApproved: boolean;
}): Promise<{ ok: false; sent: false; reason: string } | { ok: true; sent: true; review: SceneVisualReview }> {
  if (!reviewEnabled()) {
    return { ok: false, sent: false, reason: "OpenAI frame review is closed. No frame was sent." };
  }
  if (!input.agencyTransferApproved) {
    return { ok: false, sent: false, reason: "Agency approval to send frames is not recorded. No frame was sent." };
  }
  if (input.frames.length === 0 || input.frames.length > 4 || input.frames.some((frame) => !allowedFrame(frame))) {
    return { ok: false, sent: false, reason: "Frames must be one to four still images from an allowed address. No frame was sent." };
  }
  const model = process.env.SCENE_OPENAI_MODEL_VISUAL?.trim() || "gpt-6.1-terra";
  const result = await createVisionJsonResponse({
    model,
    instructions: SCENE_REVIEW_INSTRUCTIONS,
    prompt: `eventId ${input.eventId}. cameraId ${input.cameraId}. Return only the structured review.`,
    imageUrls: input.frames,
    jsonSchemaName: "scene_visual_review",
    jsonSchema: JSON_SCHEMA,
  });
  if (!result) return { ok: false, sent: false, reason: "The visual review request did not return a usable response. No observation was stored." };
  let body: unknown;
  try {
    body = JSON.parse(result.text);
  } catch {
    return { ok: false, sent: false, reason: "The model response was not valid JSON. It was not stored." };
  }
  const parsed = parseSceneVisualReview(body);
  if (!parsed.ok) return { ok: false, sent: false, reason: parsed.reason };
  return { ok: true, sent: true, review: parsed.review };
}
