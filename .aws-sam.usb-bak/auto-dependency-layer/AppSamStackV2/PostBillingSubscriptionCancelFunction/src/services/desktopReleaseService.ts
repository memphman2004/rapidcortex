import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  DesktopPlatform,
  DesktopReleaseCard,
  DesktopReleasesOverviewResponse,
  DesktopSignedUrlResponse,
  UserContext,
} from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { requireRole } from "../lib/authz.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";

const s3 = new S3Client({ region: env.region });
const auditRepo = new AuditRepository();

const MAC_INSTALL =
  "Open the DMG, drag Rapid Cortex into Applications, then launch from Applications. If macOS blocks the first launch, use System Settings → Privacy & Security to approve the Developer ID–signed app. The app still requires Rapid Cortex sign-in before any incident data is available.";

const WIN_INSTALL =
  "Run the signed installer from an agency-controlled location. The desktop app requires Rapid Cortex sign-in before any incident data is available.";

function canDownloadDesktopInstallers(user: UserContext): boolean {
  if (isRcsuperadmin(user)) return true;
  return requireRole(user, ["agencyadmin", "agencyit"]);
}

export class DesktopReleaseService {
  assertCanDownloadDesktopInstallers(user: UserContext): void {
    if (!canDownloadDesktopInstallers(user)) throw new Error("FORBIDDEN");
  }

  async getOverview(): Promise<DesktopReleasesOverviewResponse> {
    const [macos, windows] = await Promise.all([this.buildCard("macos"), this.buildCard("windows")]);
    return { macos, windows };
  }

  async issueSignedUrl(user: UserContext, platform: DesktopPlatform): Promise<DesktopSignedUrlResponse> {
    this.assertCanDownloadDesktopInstallers(user);
    const key = platform === "macos" ? env.desktopMacosS3Key : env.desktopWindowsS3Key;
    if (!key) {
      const err = new Error("INSTALLER_NOT_PUBLISHED");
      (err as Error & { code?: string }).code = "INSTALLER_NOT_PUBLISHED";
      throw err;
    }
    const version = platform === "macos" ? env.desktopMacosVersion : env.desktopWindowsVersion;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: env.assetsBucket, Key: key }));
    } catch {
      const err = new Error("INSTALLER_NOT_FOUND");
      (err as Error & { code?: string }).code = "INSTALLER_NOT_FOUND";
      throw err;
    }
    const cmd = new GetObjectCommand({ Bucket: env.assetsBucket, Key: key });
    const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: env.desktopDownloadUrlTtlSeconds });
    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.DESKTOP_INSTALLER_DOWNLOAD_URL_ISSUED,
      details: {
        platform,
        version,
        role: user.role,
        artifactFileName:
          platform === "macos" ? env.desktopMacosArtifactName : env.desktopWindowsArtifactName,
      },
      createdAt: now,
      resourceType: "integration",
      resourceId: `desktop:${platform}`,
    });
    return {
      platform,
      downloadUrl,
      downloadUrlExpiresInSeconds: env.desktopDownloadUrlTtlSeconds,
    };
  }

  private async buildCard(platform: DesktopPlatform): Promise<DesktopReleaseCard> {
    const isMac = platform === "macos";
    const key = isMac ? env.desktopMacosS3Key : env.desktopWindowsS3Key;
    const base: DesktopReleaseCard = {
      platform,
      available: false,
      version: isMac ? env.desktopMacosVersion : env.desktopWindowsVersion,
      releasedAt: (isMac ? env.desktopMacosReleasedAt : env.desktopWindowsReleasedAt) || null,
      minOSVersion: isMac ? env.desktopMacosMinOs : env.desktopWindowsMinOs,
      fileBytes: isMac
        ? env.desktopMacosFileBytes > 0
          ? env.desktopMacosFileBytes
          : null
        : env.desktopWindowsFileBytes > 0
          ? env.desktopWindowsFileBytes
          : null,
      sha256: (isMac ? env.desktopMacosSha256 : env.desktopWindowsSha256) || null,
      artifactFileName: isMac ? env.desktopMacosArtifactName : env.desktopWindowsArtifactName,
      installationNotes: isMac ? MAC_INSTALL : WIN_INSTALL,
    };
    if (!key) return base;
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: env.assetsBucket, Key: key }));
      const fileBytes = typeof head.ContentLength === "number" ? head.ContentLength : base.fileBytes;
      const releasedAt = head.LastModified ? head.LastModified.toISOString() : base.releasedAt;
      return { ...base, available: true, fileBytes, releasedAt };
    } catch {
      return base;
    }
  }
}
