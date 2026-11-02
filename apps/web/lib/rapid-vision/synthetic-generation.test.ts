import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { associateClipFrame, imageQuality, marksFromDetectedText, reviewSyntheticUpload, syntheticTrainingBlock, validateStudioClip, validateStudioImage } from "./synthetic-generation";
import { attemptFitsSpend, progressSummary } from "./studio-batch";
import { verifyTrainingLabel } from "./studio-review-gates";
import type { StudioReviewRecord } from "./studio-dataset";

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
  return out;
}

function png(width: number, height: number, text?: string): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr)];
  if (text) parts.push(pngChunk("tEXt", Buffer.from(`Comment\0${text}`, "latin1")));
  parts.push(pngChunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

const ready = {
  category: "firearm_like",
  prompt: "Synthetic parking-garage camera. A generated person holds a dark pistol shape.",
  modelId: "gpt-image-2.5-flare",
  syntheticPeople: true,
  cleanFrame: true,
  contentType: "image/png",
  byteLength: 1200,
};

describe("synthetic upload rules", () => {
  it("accepts a synthetic frame with prompt and model provenance", () => {
    expect(reviewSyntheticUpload(ready).ok).toBe(true);
  });

  it("rejects a missing prompt, a missing model, a real likeness, and burned-in text", () => {
    expect(reviewSyntheticUpload({ ...ready, prompt: "  " }).ok).toBe(false);
    expect(reviewSyntheticUpload({ ...ready, modelId: "" }).ok).toBe(false);
    expect(reviewSyntheticUpload({ ...ready, syntheticPeople: false }).ok).toBe(false);
    expect(reviewSyntheticUpload({ ...ready, cleanFrame: false }).ok).toBe(false);
  });

  it("accepts a clean image and rejects each failed file on its own", () => {
    const clean = validateStudioImage(png(1024, 1024), "image/png");
    expect(clean.ok).toBe(true);
    if (clean.ok) expect(clean.framesExtracted).toBe(false);
    expect(validateStudioImage(png(320, 1024), "image/png").ok).toBe(false);
    expect(validateStudioImage(Buffer.alloc(40), "image/png").ok).toBe(false);
    expect(validateStudioImage(Buffer.alloc(8_000_001), "image/png").ok).toBe(false);
    expect(validateStudioImage(png(1024, 1024), "image/gif").ok).toBe(false);
    const stamped = validateStudioImage(png(1024, 1024), "image/png", marksFromDetectedText(["12:01:05"]));
    expect(stamped.ok).toBe(false);
    if (!stamped.ok) expect(stamped.reason).toContain("timestamp");
    const branded = validateStudioImage(png(1024, 1024, "iQ Vision"), "image/png");
    expect(branded.ok).toBe(false);
    if (!branded.ok) expect(branded.reason).toContain("iQ Vision");
    const labeled = validateStudioImage(png(1024, 1024), "image/png", marksFromDetectedText(["EXIT"]));
    expect(labeled.ok).toBe(false);
    if (!labeled.ok) expect(labeled.reason).toContain("not accepted");
  });

  it("keeps an MP4 as the original clip and does not extract a frame", () => {
    const clip = Buffer.alloc(32);
    clip.write("ftyp", 4, "ascii");
    const result = validateStudioClip(clip, "video/mp4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.framesExtracted).toBe(false);
    expect(validateStudioClip(clip, "video/mp4", [{ kind: "timestamp", value: "00:00:01" }]).ok).toBe(false);
  });

  it("reports accepted files separately from requested and rejected files", () => {
    expect(progressSummary({ requested: 100, accepted: 97, generated: 97, failed: 1, qualityRejected: 2, queued: 97 })).toBe(
      "Requested 100. Accepted 97. Rejected 3. Failed 1. Quality-rejected 2. Queued 97.",
    );
    expect(attemptFitsSpend(39.96, 0, 40)).toBe(true);
    expect(attemptFitsSpend(39.96, 1, 40)).toBe(false);
  });

  it("rejects an image that is smaller than 640 pixels on either edge", () => {
    const tiny = Buffer.alloc(32);
    tiny.write("PNG", 1, "ascii");
    tiny[0] = 0x89;
    tiny.writeUInt32BE(320, 16);
    tiny.writeUInt32BE(1024, 20);
    const quality = imageQuality(tiny, "image/png");
    expect(quality.ok).toBe(false);
  });

  it("does not verify an upload from typed metadata, even with a box and rights", () => {
    const upload = {
      id: "upload-1",
      kind: "synthetic-image",
      status: "APPROVED",
      approved: true,
      trainingLabel: false,
      modelId: "chatgpt",
      category: "firearm_like",
      createdAt: "2026-11-01T00:00:00.000Z",
      synthetic: true,
      rightsStatus: "synthetic_internal",
      rightsVerifiedAt: "2026-11-01T00:00:00.000Z",
      prompt: "A synthetic person.",
      provenance: "upload",
      qualityStatus: "passed",
      box: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
      syntheticPersonAttestation: {
        id: "attest-1",
        noRealLikenessIntentionallyReproduced: true,
        attestedBy: "upload",
        attestedAt: "2026-11-01T00:00:00.000Z",
      },
    } satisfies StudioReviewRecord;
    const result = verifyTrainingLabel(upload, "ada@nexcortiq.us", "2026-11-01T00:10:00.000Z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not a generation job");
    expect(syntheticTrainingBlock({ ...upload, provenance: "generation_job", generationJobId: "job-1" })).toBeNull();
  });

  it("keeps a clip frame tied to the source video and unverified", () => {
    const missing = associateClipFrame({ sourceVideoId: "clip-1", sourceTimestampSeconds: 1.5 });
    expect(missing.ok).toBe(false);
    const linked = associateClipFrame({
      sourceVideoId: "clip-1",
      sourceTimestampSeconds: 1.5,
      prompt: "Two synthetic people stand beside two cars.",
      modelId: "chatgpt",
      generationJobId: "job-1",
      attestationId: "attest-1",
    });
    expect(linked.ok).toBe(true);
    if (linked.ok) {
      expect(linked.trainingLabel).toBe(false);
      expect(linked.sourceVideoId).toBe("clip-1");
      expect(linked.sourceTimestampSeconds).toBe(1.5);
    }
  });
});