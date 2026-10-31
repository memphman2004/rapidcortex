import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    kind: item.kind === "synthetic-image" || item.kind === "discovered" ? item.kind : "visual-review",
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
    audit: auditFrom(item.audit),
    distance: typeof item.distance === "string" ? item.distance : null,
    difficulty: item.difficulty === "challenging" || item.difficulty === "standard" ? item.difficulty : undefined,
    sourceType: item.sourceType === "synthetic" || item.sourceType === "public" || item.sourceType === "unknown" ? item.sourceType : undefined,
    batchId: typeof item.batchId === "string" ? item.batchId : undefined,
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
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
  return (result.Items ?? []).some((item) => item.status === "QUEUED" || item.status === "RUNNING");
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
