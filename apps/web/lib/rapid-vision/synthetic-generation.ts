/**
 * Rules for owned synthetic frames.
 * A real person's likeness is refused. An unverified upload is not a training label.
 */
import { BATCH_CATEGORY_CHOICES } from "./studio-batch";

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export const SYNTHETIC_GENERATION = {
  allowPeople: true,
  allowSyntheticFaces: true,
  allowMultiplePeople: true,
  allowHumanInteractions: true,
  allowWeapons: true,
  allowFights: true,
  allowVehicleAccidents: true,
  allowRealPersonLikeness: false,
  allowBurnedInText: false,
  allowLogos: false,
  allowTimestamps: false,
  rights: "synthetic_internal",
  requirePromptProvenance: true,
  requireModelProvenance: true,
  requireManualVerification: true,
} as const;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const CLIP_TYPES = new Set(["video/mp4", "video/quicktime"]);
export const SYNTHETIC_UPLOAD_MAX_BYTES = 8_000_000;
export const SYNTHETIC_CLIP_MAX_BYTES = 40_000_000;
export const MIN_SYNTHETIC_IMAGE_EDGE = 640;

export type SyntheticMedia = "image" | "clip";

export function readImageSize(bytes: Buffer, contentType: string): { ok: true; width: number; height: number } | { ok: false; reason: string } {
  if (contentType === "image/png") {
    if (bytes.length < 24 || bytes[0] !== 0x89 || bytes.toString("ascii", 1, 4) !== "PNG") {
      return { ok: false, reason: "The file is not a readable PNG. The image was not stored." };
    }
    return { ok: true, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (contentType === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return { ok: false, reason: "The file is not a readable JPEG. The image was not stored." };
    }
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1] ?? 0;
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { ok: true, height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
    return { ok: false, reason: "The JPEG size could not be read. The image was not stored." };
  }
  if (contentType === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.toString("ascii", 12, 16) === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes.readUIntLE(24, 3);
    const height = 1 + bytes.readUIntLE(27, 3);
    return { ok: true, width, height };
  }
  return { ok: false, reason: "The image size could not be read. The image was not stored." };
}

export type OverlayMark = { kind: "text" | "timestamp" | "logo"; value: string };

/** Short detected lines are burned-in overlays. A long prompt stored as metadata is not one. */
export function marksFromDetectedText(lines: readonly string[]): OverlayMark[] {
  const marks: OverlayMark[] = [];
  for (const raw of lines) {
    const value = raw.trim();
    if (!value || value.length > 80) continue;
    if (/^(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?|\d{4}-\d{2}-\d{2}(?:[ t]\d{2}:\d{2}(?::\d{2})?)?)$/i.test(value)) {
      marks.push({ kind: "timestamp", value });
    } else if (/\b(?:watermark|logo|copyright)\b/i.test(value) || value.includes("©") || /iq\s*vision/i.test(value)) {
      marks.push({ kind: "logo", value });
    } else {
      marks.push({ kind: "text", value });
    }
  }
  return marks;
}

function chunkText(bytes: Buffer, start: number, length: number): string {
  return bytes.toString("latin1", start, start + length).replace(/\0/g, " ").trim();
}

function metadataMarks(lines: readonly string[]): OverlayMark[] {
  const marks: OverlayMark[] = [];
  for (const raw of lines) {
    const value = raw.trim();
    if (/iq\s*vision/i.test(value)) marks.push({ kind: "logo", value: "iQ Vision" });
    if (/^(?:watermark|logo|copyright)$/i.test(value) || value === "©") marks.push({ kind: "logo", value });
    if (/^(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?|\d{4}-\d{2}-\d{2}(?:[ t]\d{2}:\d{2}(?::\d{2})?)?)$/i.test(value)) {
      marks.push({ kind: "timestamp", value });
    }
  }
  return marks;
}

/** Reads overlay text the file actually carries. A prompt sentence is not treated as a watermark. */
export function embeddedOverlayMarks(bytes: Buffer, contentType: string): OverlayMark[] {
  const lines: string[] = [];
  if (/iq\s*vision/i.test(bytes.toString("latin1"))) lines.push("iQ Vision");
  if (contentType === "image/png" && bytes.length > 8) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      if (!Number.isFinite(length) || offset + 12 + length > bytes.length) break;
      if (type === "tEXt" || type === "iTXt") lines.push(chunkText(bytes, offset + 8, length));
      if (type === "IEND") break;
      offset += 12 + length;
    }
  }
  if (contentType === "image/jpeg") {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1] ?? 0;
      if (marker === 0xfe) {
        const length = bytes.readUInt16BE(offset + 2);
        lines.push(chunkText(bytes, offset + 4, Math.max(0, length - 2)));
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return metadataMarks(lines);
}

function pngIntact(bytes: Buffer): { ok: true; width: number; height: number } | { ok: false; reason: string } {
  const size = readImageSize(bytes, "image/png");
  if (!size.ok) return size;
  let offset = 8;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (offset + 12 + length > bytes.length) {
      return { ok: false, reason: "The PNG is truncated. The image was not accepted." };
    }
    const body = bytes.subarray(offset + 4, offset + 8 + length);
    const expected = crc32(body) >>> 0;
    const actual = bytes.readUInt32BE(offset + 8 + length);
    if (expected !== actual) {
      return { ok: false, reason: "The PNG checksum does not match. The image was not accepted." };
    }
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
    offset += 12 + length;
  }
  if (!sawEnd) return { ok: false, reason: "The PNG is incomplete. The image was not accepted." };
  return size;
}

function jpegIntact(bytes: Buffer): { ok: true; width: number; height: number } | { ok: false; reason: string } {
  const size = readImageSize(bytes, "image/jpeg");
  if (!size.ok) return size;
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return { ok: false, reason: "The JPEG is incomplete. The image was not accepted." };
  }
  return size;
}

/** One image. Type, size, dimensions, integrity, and overlay marks are all required. */
export function validateStudioImage(
  bytes: Buffer,
  contentType: string,
  marks: readonly OverlayMark[] = [],
): { ok: true; width: number; height: number; framesExtracted: false } | { ok: false; reason: string } {
  if (!IMAGE_TYPES.has(contentType)) {
    return { ok: false, reason: "The file must be a PNG, JPEG, or WebP. The image was not accepted." };
  }
  if (bytes.length < 32) return { ok: false, reason: "The file is empty. The image was not accepted." };
  if (bytes.length > SYNTHETIC_UPLOAD_MAX_BYTES) {
    return { ok: false, reason: "The image is larger than 8 MB. The image was not accepted." };
  }
  const intact = contentType === "image/png" ? pngIntact(bytes) : contentType === "image/jpeg" ? jpegIntact(bytes) : readImageSize(bytes, contentType);
  if (!intact.ok) return intact;
  if (intact.width < MIN_SYNTHETIC_IMAGE_EDGE || intact.height < MIN_SYNTHETIC_IMAGE_EDGE) {
    return { ok: false, reason: `The image is ${intact.width} by ${intact.height}. Both edges must be at least ${MIN_SYNTHETIC_IMAGE_EDGE} pixels. The image was not accepted.` };
  }
  const found = [...embeddedOverlayMarks(bytes, contentType), ...marks].find((mark) => mark.value.trim().length > 0);
  if (found) {
    return { ok: false, reason: `Burned-in ${found.kind} was detected (${found.value}). The image was not accepted.` };
  }
  return { ok: true, width: intact.width, height: intact.height, framesExtracted: false };
}

/** The original clip is kept. Frames are not extracted. */
export function validateStudioClip(bytes: Buffer, contentType: string, marks: readonly OverlayMark[] = []): { ok: true; framesExtracted: false } | { ok: false; reason: string } {
  if (!CLIP_TYPES.has(contentType)) {
    return { ok: false, reason: "The file must be an MP4. The clip was not accepted." };
  }
  if (bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp") {
    return { ok: false, reason: "The clip is not a readable MP4. The clip was not accepted." };
  }
  if (bytes.length > SYNTHETIC_CLIP_MAX_BYTES) {
    return { ok: false, reason: "The clip is larger than 40 MB. The clip was not accepted." };
  }
  const found = [...embeddedOverlayMarks(bytes, contentType), ...marks].find((mark) => mark.value.trim().length > 0);
  if (found) return { ok: false, reason: `Burned-in ${found.kind} was detected (${found.value}). The clip was not accepted.` };
  return { ok: true, framesExtracted: false };
}

export function imageQuality(bytes: Buffer, contentType: string): { ok: true; width: number; height: number } | { ok: false; reason: string } {
  const size = readImageSize(bytes, contentType);
  if (!size.ok) return size;
  if (size.width < MIN_SYNTHETIC_IMAGE_EDGE || size.height < MIN_SYNTHETIC_IMAGE_EDGE) {
    return { ok: false, reason: `The image is ${size.width} by ${size.height}. Both edges must be at least ${MIN_SYNTHETIC_IMAGE_EDGE} pixels. The image was not stored.` };
  }
  return size;
}

export function syntheticTrainingBlock(record: {
  kind?: string;
  synthetic?: boolean;
  provenance?: "generation_job" | "upload" | "clip";
  prompt?: string;
  modelId?: string;
  generationJobId?: string;
  qualityStatus?: "passed" | "failed";
  syntheticPersonAttestation?: { noRealLikenessIntentionallyReproduced?: boolean };
  sourceVideoId?: string;
  sourceTimestampSeconds?: number;
}): string | null {
  if (record.kind === "synthetic-clip" || record.provenance === "clip") {
    return "A source clip is not a training frame. No frame from this clip was verified.";
  }
  if (!record.synthetic || !record.provenance) return null;
  if (record.provenance === "upload") {
    return "A typed prompt and model id are not a generation job. The label was not verified.";
  }
  if (!record.generationJobId?.trim() || !record.prompt?.trim() || !record.modelId?.trim()) {
    return "The prompt and model id are not tied to a generation job. The label was not verified.";
  }
  if (record.syntheticPersonAttestation?.noRealLikenessIntentionallyReproduced !== true) {
    return "The synthetic-person record must attest that no real person's likeness was intentionally reproduced. The label was not verified.";
  }
  if (record.qualityStatus !== "passed") {
    return "Image quality has not passed. The label was not verified.";
  }
  if (record.sourceVideoId && !(typeof record.sourceTimestampSeconds === "number" && record.sourceTimestampSeconds >= 0)) {
    return "A frame from a clip needs the source video and a timestamp. The label was not verified.";
  }
  return null;
}

/** A frame keeps the original clip and cannot become a training label by itself. */
export function associateClipFrame(input: {
  sourceVideoId?: string;
  sourceTimestampSeconds?: number;
  prompt?: string;
  modelId?: string;
  generationJobId?: string;
  attestationId?: string;
}): { ok: false; reason: string } | {
  ok: true;
  trainingLabel: false;
  provenance: "generation_job";
  sourceVideoId: string;
  sourceTimestampSeconds: number;
  prompt: string;
  modelId: string;
  generationJobId: string;
  syntheticPersonAttestationId: string;
} {
  if (!input.sourceVideoId?.trim()) return { ok: false, reason: "A frame needs its source clip. No frame was stored." };
  if (typeof input.sourceTimestampSeconds !== "number" || input.sourceTimestampSeconds < 0) {
    return { ok: false, reason: "A frame needs a timestamp in the source clip. No frame was stored." };
  }
  if (!input.prompt?.trim() || !input.modelId?.trim() || !input.generationJobId?.trim() || !input.attestationId?.trim()) {
    return { ok: false, reason: "A frame needs the generation job, the prompt, the model id, and the synthetic-person record. No frame was stored." };
  }
  return {
    ok: true,
    trainingLabel: false,
    provenance: "generation_job",
    sourceVideoId: input.sourceVideoId.trim(),
    sourceTimestampSeconds: input.sourceTimestampSeconds,
    prompt: input.prompt.trim(),
    modelId: input.modelId.trim(),
    generationJobId: input.generationJobId.trim(),
    syntheticPersonAttestationId: input.attestationId.trim(),
  };
}

export function reviewSyntheticUpload(input: {
  category?: string;
  prompt?: string;
  modelId?: string;
  syntheticPeople?: boolean;
  cleanFrame?: boolean;
  contentType?: string;
  byteLength?: number;
}): { ok: true; contentType: string; media: SyntheticMedia } | { ok: false; reason: string } {
  if (!BATCH_CATEGORY_CHOICES.some((choice) => choice.id === input.category)) {
    return { ok: false, reason: "Choose a studio category. The image was not stored." };
  }
  if (SYNTHETIC_GENERATION.requirePromptProvenance && !input.prompt?.trim()) {
    return { ok: false, reason: "A prompt is required. The image was not stored." };
  }
  if (SYNTHETIC_GENERATION.requireModelProvenance && !input.modelId?.trim()) {
    return { ok: false, reason: "A model id is required. The image was not stored." };
  }
  if (!SYNTHETIC_GENERATION.allowRealPersonLikeness && input.syntheticPeople !== true) {
    return { ok: false, reason: "A real person's likeness cannot be uploaded. The image was not stored." };
  }
  if ((!SYNTHETIC_GENERATION.allowBurnedInText || !SYNTHETIC_GENERATION.allowLogos || !SYNTHETIC_GENERATION.allowTimestamps) && input.cleanFrame !== true) {
    return { ok: false, reason: "Burned-in text, logos, and timestamps are not allowed. The image was not stored." };
  }
  const contentType = input.contentType?.trim().toLowerCase() ?? "";
  const media: SyntheticMedia | null = IMAGE_TYPES.has(contentType) ? "image" : CLIP_TYPES.has(contentType) ? "clip" : null;
  if (!media) {
    return { ok: false, reason: "The file must be a PNG, JPEG, WebP, or a short MP4. The file was not stored." };
  }
  const maxBytes = media === "clip" ? SYNTHETIC_CLIP_MAX_BYTES : SYNTHETIC_UPLOAD_MAX_BYTES;
  if (!input.byteLength || input.byteLength < 32) {
    return { ok: false, reason: "The file is empty. The file was not stored." };
  }
  if (input.byteLength > maxBytes) {
    return { ok: false, reason: media === "clip" ? "The clip is larger than 40 MB. The clip was not stored." : "The image is larger than 8 MB. The image was not stored." };
  }
  return { ok: true, contentType, media };
}
