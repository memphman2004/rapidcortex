import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { BatchProgress } from "./studio-batch";
import { STUDIO_EVENTS_TABLE, STUDIO_PARTITION, type DatasetVersion, type StudioReviewRecord, type StudioReviewStatus } from "./studio-dataset";

const document = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function tableName(): string {
  return process.env.VISION_EVENTS_TABLE?.trim() || STUDIO_EVENTS_TABLE;
}

function itemFrom(record: StudioReviewRecord): Record<string, unknown> {
  return {
    ...record,
    pk: STUDIO_PARTITION,
    sk: `REVIEW#${record.id}`,
    gsi1pk: `${STUDIO_PARTITION}#STATUS#${record.status}`,
    gsi1sk: `${record.createdAt}#${record.id}`,
    recordType: "studio_review",
  };
}

export function recordFrom(item: Record<string, unknown>): StudioReviewRecord | null {
  if (item.recordType !== "studio_review" || typeof item.id !== "string") return null;
  const status = item.status;
  if (status !== "REVIEW_REQUIRED" && status !== "APPROVED" && status !== "REJECTED" && status !== "CORRECTION_REQUESTED") return null;
  return {
    id: item.id,
    kind: item.kind === "synthetic-image" || item.kind === "synthetic-clip" || item.kind === "discovered" ? item.kind : "visual-review",
    status: status as StudioReviewStatus,
    approved: item.approved === true,
    trainingLabel: typeof item.labelVerifiedAt === "string" && item.labelVerifiedAt.length > 0,
    modelId: String(item.modelId ?? ""),
    category: String(item.category ?? ""),
    createdAt: String(item.createdAt ?? ""),
    synthetic: item.synthetic === true,
    sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined,
    license: typeof item.license === "string" ? item.license : undefined,
    rightsStatus:
      item.rightsStatus === "UNKNOWN" ||
      item.rightsStatus === "synthetic_internal" ||
      item.rightsStatus === "LICENSE_VERIFIED" ||
      item.rightsStatus === "RESTRICTED"
        ? item.rightsStatus
        : "REVIEW_REQUIRED",
    objects: Array.isArray(item.objects) ? item.objects.filter((value): value is string => typeof value === "string") : undefined,
    uncertainty: typeof item.uncertainty === "string" ? item.uncertainty : undefined,
    annotation: typeof item.annotation === "string" ? item.annotation : undefined,
    prompt: typeof item.prompt === "string" ? item.prompt : undefined,
    s3Key: typeof item.s3Key === "string" ? item.s3Key : undefined,
    lighting: typeof item.lighting === "string" ? item.lighting : null,
    cameraAngle: typeof item.cameraAngle === "string" ? item.cameraAngle : null,
    occlusion: typeof item.occlusion === "string" ? item.occlusion : null,
    objectSize: typeof item.objectSize === "string" ? item.objectSize : null,
    role: item.role === "positive" || item.role === "negative" ? item.role : undefined,
    correctedLabel: typeof item.correctedLabel === "string" ? item.correctedLabel : undefined,
    reviewerNote: typeof item.reviewerNote === "string" ? item.reviewerNote : undefined,
    author: typeof item.author === "string" ? item.author : undefined,
    commercialUse:
      item.commercialUse === "permitted" || item.commercialUse === "not_permitted" || item.commercialUse === "unverified"
        ? item.commercialUse
        : undefined,
    privacy: typeof item.privacy === "string" ? item.privacy : undefined,
    rightsReviewer: typeof item.rightsReviewer === "string" ? item.rightsReviewer : undefined,
    rightsVerifiedAt: typeof item.rightsVerifiedAt === "string" ? item.rightsVerifiedAt : undefined,
    labelReviewer: typeof item.labelReviewer === "string" ? item.labelReviewer : undefined,
    labelVerifiedAt: typeof item.labelVerifiedAt === "string" ? item.labelVerifiedAt : undefined,
    box: boxFrom(item.box),
    boxes: boxesFrom(item.boxes, item.box),
    audit: auditFrom(item.audit),
    distance: typeof item.distance === "string" ? item.distance : null,
    difficulty: item.difficulty === "challenging" || item.difficulty === "standard" ? item.difficulty : undefined,
    sourceType: item.sourceType === "synthetic" || item.sourceType === "public" || item.sourceType === "unknown" ? item.sourceType : undefined,
    batchId: typeof item.batchId === "string" ? item.batchId : undefined,
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
    provenance: item.provenance === "generation_job" || item.provenance === "upload" || item.provenance === "clip" ? item.provenance : undefined,
    generationJobId: typeof item.generationJobId === "string" ? item.generationJobId : undefined,
    qualityStatus: item.qualityStatus === "passed" || item.qualityStatus === "failed" ? item.qualityStatus : undefined,
    syntheticPersonAttestation: attestationFrom(item.syntheticPersonAttestation),
    sourceVideoId: typeof item.sourceVideoId === "string" ? item.sourceVideoId : undefined,
    sourceTimestampSeconds: typeof item.sourceTimestampSeconds === "number" ? item.sourceTimestampSeconds : undefined,
  };
}

function attestationFrom(value: unknown): StudioReviewRecord["syntheticPersonAttestation"] {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.noRealLikenessIntentionallyReproduced !== true) return undefined;
  if (typeof row.attestedBy !== "string" || typeof row.attestedAt !== "string") return undefined;
  return {
    id: row.id,
    noRealLikenessIntentionallyReproduced: true,
    attestedBy: row.attestedBy,
    attestedAt: row.attestedAt,
  };
}

function boxFrom(value: unknown): StudioReviewRecord["box"] {
  if (!value || typeof value !== "object") return undefined;
  const box = value as Record<string, unknown>;
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if ([x, y, width, height].some((n) => !Number.isFinite(n))) return undefined;
  return { x, y, width, height };
}

function boxesFrom(value: unknown, legacyBox: unknown): StudioReviewRecord["boxes"] {
  if (Array.isArray(value)) {
    const boxes = value.map(boxFrom).filter((box): box is NonNullable<StudioReviewRecord["box"]> => Boolean(box));
    return boxes.length > 0 ? boxes : undefined;
  }
  const single = boxFrom(legacyBox);
  return single ? [single] : undefined;
}

function auditFrom(value: unknown): StudioReviewRecord["audit"] {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.at !== "string" || typeof row.reviewer !== "string" || typeof row.action !== "string") return [];
    return [{ at: row.at, reviewer: row.reviewer, action: row.action, note: typeof row.note === "string" ? row.note : undefined }];
  });
}

export async function listStudioReviews(): Promise<StudioReviewRecord[]> {
  const result = await document.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": STUDIO_PARTITION, ":sk": "REVIEW#" },
    }),
  );
  return (result.Items ?? []).map((item) => recordFrom(item)).filter((item): item is StudioReviewRecord => item !== null);
}

export async function listDatasetVersions(): Promise<DatasetVersion[]> {
  const result = await document.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": STUDIO_PARTITION, ":sk": "DATASET#" },
    }),
  );
  return (result.Items ?? []).flatMap((item) => {
    if (item.recordType !== "studio_dataset" || typeof item.id !== "string") return [];
    const assetIds = stringList(item.assetIds);
    return [{
      id: item.id,
      version: Number(item.version) || 1,
      createdAt: String(item.createdAt ?? ""),
      reviewer: String(item.reviewer ?? ""),
      assetIds,
      positiveIds: stringList(item.positiveIds),
      negativeIds: stringList(item.negativeIds),
      syntheticIds: stringList(item.syntheticIds),
      realIds: stringList(item.realIds),
    }];
  });
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function saveDatasetVersion(version: DatasetVersion): Promise<void> {
  await document.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        ...version,
        pk: STUDIO_PARTITION,
        sk: `DATASET#${String(version.version).padStart(4, "0")}#${version.id}`,
        recordType: "studio_dataset",
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
}

export async function hasActiveBatchJob(): Promise<boolean> {
  const result = await document.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": STUDIO_PARTITION, ":sk": "JOB#" },
    }),
  );
  const now = Date.now();
  return (result.Items ?? []).some((item) => {
    if (item.status !== "QUEUED" && item.status !== "RUNNING") return false;
    const expires = typeof item.expiresAt === "string" ? Date.parse(item.expiresAt) : Number.NaN;
    return !Number.isFinite(expires) || expires > now;
  });
}

/** Same reviewer can continue a batch. A different reviewer waits until the lock expires. Progress counters stay on the parent job. */
export async function claimStudioBatch(batchId: string, reviewer: string, now: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const expiresAt = new Date(Date.parse(now) + 3 * 60 * 1000).toISOString();
  try {
    await document.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { pk: STUDIO_PARTITION, sk: `JOB#BATCH#${batchId}` },
        UpdateExpression: "SET recordType = :type, #status = :running, reviewer = :reviewer, batchId = :batchId, expiresAt = :expires",
        ConditionExpression: "attribute_not_exists(pk) OR reviewer = :reviewer OR expiresAt < :now OR attribute_not_exists(expiresAt)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":type": "studio_batch_job",
          ":running": "RUNNING",
          ":reviewer": reviewer,
          ":batchId": batchId,
          ":expires": expiresAt,
          ":now": now,
        },
      }),
    );
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "ConditionalCheckFailedException") {
      return { ok: false, reason: "A batch for this category is already running. Wait for it to finish before requesting another." };
    }
    throw error;
  }
}

export async function releaseStudioBatch(batchId: string): Promise<void> {
  await document.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { pk: STUDIO_PARTITION, sk: `JOB#BATCH#${batchId}` },
      UpdateExpression: "SET #status = :complete, expiresAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":complete": "COMPLETE", ":now": new Date().toISOString() },
    }),
  );
}

/** One in-flight provider call per scene. A second submission waits until this lock expires. */
export async function claimScene(sceneId: string, reviewer: string, now: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const expiresAt = new Date(Date.parse(now) + 3 * 60 * 1000).toISOString();
  try {
    await document.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          pk: STUDIO_PARTITION,
          sk: `JOB#SCENE#${sceneId}`,
          recordType: "studio_scene_job",
          status: "RUNNING",
          reviewer,
          sceneId,
          expiresAt,
        },
        ConditionExpression: "attribute_not_exists(pk) OR expiresAt < :now",
        ExpressionAttributeValues: { ":now": now },
      }),
    );
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "ConditionalCheckFailedException") {
      return { ok: false, reason: "That image is already being generated. No second request was sent." };
    }
    throw error;
  }
}

export async function releaseScene(sceneId: string): Promise<void> {
  await document.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { pk: STUDIO_PARTITION, sk: `JOB#SCENE#${sceneId}` },
      UpdateExpression: "SET #status = :complete, expiresAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":complete": "COMPLETE", ":now": new Date().toISOString() },
    }),
  );
}

export async function skipScene(batchId: string, sceneId: string, reason: "failed" | "quality_rejected"): Promise<void> {
  await document.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: STUDIO_PARTITION,
        sk: `JOB#SKIP#${sceneId}`,
        recordType: "studio_batch_skip",
        batchId,
        sceneId,
        reason,
      },
    }),
  );
}

export async function listSkippedSceneIds(): Promise<string[]> {
  const result = await document.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": STUDIO_PARTITION, ":sk": "JOB#SKIP#" },
    }),
  );
  return (result.Items ?? []).map((item) => String(item.sceneId ?? "")).filter((id) => id.length > 0);
}

export async function recordBatchOutcome(input: {
  batchId: string;
  requested: number;
  outcome: "generated" | "failed" | "quality_rejected";
}): Promise<BatchProgress> {
  const generated = input.outcome === "generated" ? 1 : 0;
  const failed = input.outcome === "failed" ? 1 : 0;
  const qualityRejected = input.outcome === "quality_rejected" ? 1 : 0;
  const result = await document.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { pk: STUDIO_PARTITION, sk: `JOB#BATCH#${input.batchId}` },
      UpdateExpression: "SET requested = :requested, accepted = if_not_exists(accepted, :zero) + :accepted, generated = if_not_exists(generated, :zero) + :generated, failed = if_not_exists(failed, :zero) + :failed, qualityRejected = if_not_exists(qualityRejected, :zero) + :qualityRejected, queued = if_not_exists(queued, :zero) + :queued",
      ExpressionAttributeValues: {
        ":requested": input.requested,
        ":zero": 0,
        ":accepted": generated,
        ":generated": generated,
        ":failed": failed,
        ":qualityRejected": qualityRejected,
        ":queued": generated,
      },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  return progressFrom(result.Attributes ?? {}, input.requested);
}

export async function readBatchProgress(batchId: string, requested: number): Promise<BatchProgress> {
  const result = await document.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: { ":pk": STUDIO_PARTITION, ":sk": `JOB#BATCH#${batchId}` },
    }),
  );
  return progressFrom(result.Items?.[0] ?? {}, requested);
}

function progressFrom(item: Record<string, unknown>, requested: number): BatchProgress {
  const generated = Number(item.generated ?? 0);
  const accepted = Number(item.accepted ?? generated);
  return {
    requested: Number(item.requested ?? requested),
    accepted,
    generated,
    failed: Number(item.failed ?? 0),
    qualityRejected: Number(item.qualityRejected ?? 0),
    queued: Number(item.queued ?? accepted),
  };
}

export async function saveStudioReview(record: StudioReviewRecord): Promise<void> {
  await document.send(
    new PutCommand({
      TableName: tableName(),
      Item: itemFrom(record),
      ConditionExpression: "attribute_not_exists(pk) OR recordType = :type",
      ExpressionAttributeValues: { ":type": "studio_review" },
    }),
  );
}

/** A generation job cannot overwrite a review that is already stored. */
export async function saveNewStudioReview(record: StudioReviewRecord): Promise<boolean> {
  try {
    await document.send(
      new PutCommand({
        TableName: tableName(),
        Item: itemFrom(record),
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}
