import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BUNDLED_ONBOARDING_PACKETS,
  ONBOARDING_PACKET_VERTICAL_LABELS,
  ONBOARDING_PACKETS_S3_PREFIX,
  bundledPacketFile,
  bundledPacketS3Key,
  canViewOnboardingPacketVertical,
  isSafeOnboardingPacketKey,
  onboardingPacketDownloadBodySchema,
  onboardingPacketVerticalsForRole,
  type OnboardingPacketVertical,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();
const s3 = new S3Client({});

const DOWNLOAD_TTL_SECONDS = 300;

export type OnboardingPacketFileDto = {
  fileName: string;
  title: string;
  key: string;
  source: "s3" | "bundled";
  contentType: string;
  sizeBytes?: number;
  updatedAt?: string;
};

export type OnboardingPacketFolderDto = {
  vertical: OnboardingPacketVertical;
  title: string;
  summary: string;
  files: OnboardingPacketFileDto[];
};

export type OnboardingPacketsListResponse = {
  folders: OnboardingPacketFolderDto[];
  storage: "s3" | "bundled";
};

function assetsBucketName(): string {
  return process.env.ASSETS_BUCKET?.trim() ?? "";
}

function assertCanViewPackets(user: UserContext): void {
  authz.assertCanPerform(user, "onboarding.packets.view");
}

async function listS3Keys(vertical: OnboardingPacketVertical): Promise<
  Array<{ key: string; sizeBytes?: number; updatedAt?: string }>
> {
  const bucket = assetsBucketName();
  if (!bucket) return [];
  const prefix = `${ONBOARDING_PACKETS_S3_PREFIX}/${vertical}/`;
  const out: Array<{ key: string; sizeBytes?: number; updatedAt?: string }> = [];
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 200,
      }),
    );
    for (const obj of page.Contents ?? []) {
      const key = obj.Key?.trim() ?? "";
      if (!key || key.endsWith("/")) continue;
      if (!isSafeOnboardingPacketKey(key, vertical)) continue;
      out.push({
        key,
        sizeBytes: typeof obj.Size === "number" ? obj.Size : undefined,
        updatedAt: obj.LastModified ? obj.LastModified.toISOString() : undefined,
      });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

function bundledFolderDto(vertical: OnboardingPacketVertical): OnboardingPacketFolderDto | null {
  const bundled = BUNDLED_ONBOARDING_PACKETS.find((folder) => folder.vertical === vertical);
  if (!bundled) return null;
  return {
    vertical,
    title: bundled.title,
    summary: bundled.summary,
    files: bundled.files.map((file) => ({
      fileName: file.fileName,
      title: file.title,
      key: bundledPacketS3Key(vertical, file.fileName),
      source: "bundled" as const,
      contentType: file.contentType,
      sizeBytes: Buffer.byteLength(file.markdown, "utf8"),
    })),
  };
}

export async function listOnboardingPackets(user: UserContext): Promise<OnboardingPacketsListResponse> {
  assertCanViewPackets(user);
  const allowed = onboardingPacketVerticalsForRole(user.role);
  const folders: OnboardingPacketFolderDto[] = [];
  let usedS3 = false;

  for (const vertical of allowed) {
    let s3Files: Array<{ key: string; sizeBytes?: number; updatedAt?: string }> = [];
    try {
      s3Files = await listS3Keys(vertical);
    } catch (error) {
      console.warn("[onboarding-packets] S3 list skipped", vertical, error);
    }
    const bundled = bundledFolderDto(vertical);
    const filesByName = new Map<string, OnboardingPacketFileDto>();
    for (const file of bundled?.files ?? []) {
      filesByName.set(file.fileName, file);
    }
    if (s3Files.length > 0) {
      usedS3 = true;
      for (const row of s3Files) {
        const fileName = row.key.slice(`${ONBOARDING_PACKETS_S3_PREFIX}/${vertical}/`.length);
        const existing = bundledPacketFile(vertical, fileName);
        filesByName.set(fileName, {
          fileName,
          title: existing?.title ?? fileName,
          key: row.key,
          source: "s3",
          contentType: existing?.contentType ?? "application/octet-stream",
          sizeBytes: row.sizeBytes,
          updatedAt: row.updatedAt,
        });
      }
    }
    if (filesByName.size === 0) continue;
    folders.push({
      vertical,
      title: ONBOARDING_PACKET_VERTICAL_LABELS[vertical],
      summary: bundled?.summary ?? "",
      files: [...filesByName.values()].sort((a, b) => a.fileName.localeCompare(b.fileName)),
    });
  }

  return { folders, storage: usedS3 ? "s3" : "bundled" };
}

export async function issueOnboardingPacketDownload(
  user: UserContext,
  body: unknown,
): Promise<{
  fileName: string;
  contentType: string;
  downloadUrl?: string;
  expiresInSeconds?: number;
  markdown?: string;
}> {
  assertCanViewPackets(user);
  const parsed = onboardingPacketDownloadBodySchema.parse(body);
  if (!canViewOnboardingPacketVertical(user.role, parsed.vertical)) {
    throw Object.assign(new Error("FORBIDDEN_VERTICAL"), { code: "FORBIDDEN_VERTICAL" });
  }
  if (!isSafeOnboardingPacketKey(parsed.key, parsed.vertical)) {
    throw Object.assign(new Error("INVALID_KEY"), { code: "INVALID_KEY" });
  }

  const fileName = parsed.key.slice(`${ONBOARDING_PACKETS_S3_PREFIX}/${parsed.vertical}/`.length);
  const bucket = assetsBucketName();

  if (bucket) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: parsed.key }));
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: parsed.key });
      const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: DOWNLOAD_TTL_SECONDS });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ONBOARDING_PACKET_DOWNLOAD_URL_ISSUED,
        details: { vertical: parsed.vertical, key: parsed.key, source: "s3" },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: parsed.key,
      });
      return {
        fileName,
        contentType: bundledPacketFile(parsed.vertical, fileName)?.contentType ?? "application/octet-stream",
        downloadUrl,
        expiresInSeconds: DOWNLOAD_TTL_SECONDS,
      };
    } catch (error) {
      console.warn("[onboarding-packets] S3 presign failed, trying bundled", error);
    }
  }

  const bundled = bundledPacketFile(parsed.vertical, fileName);
  if (!bundled) {
    throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
  }

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: user.agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.ONBOARDING_PACKET_DOWNLOAD_URL_ISSUED,
    details: { vertical: parsed.vertical, key: parsed.key, source: "bundled" },
    createdAt: new Date().toISOString(),
    resourceType: "agency",
    resourceId: parsed.key,
  });

  return {
    fileName: bundled.fileName,
    contentType: bundled.contentType,
    markdown: bundled.markdown,
  };
}
