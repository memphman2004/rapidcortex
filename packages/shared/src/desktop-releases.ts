export type DesktopPlatform = "macos" | "windows";

/**
 * One installer card (metadata only — no download URLs on the overview response).
 */
export type DesktopReleaseCard = {
  platform: DesktopPlatform;
  /** True when the S3 object key is configured and HeadObject succeeds. */
  available: boolean;
  version: string;
  releasedAt: string | null;
  /** macOS: dotted version (e.g. 13.0). Windows: display string (e.g. Windows 10 22H2). */
  minOSVersion: string;
  fileBytes: number | null;
  sha256: string | null;
  artifactFileName: string;
  installationNotes: string;
};

/** GET /api/admin/desktop-releases — authenticated, authorized roles only. */
export type DesktopReleasesOverviewResponse = {
  macos: DesktopReleaseCard;
  windows: DesktopReleaseCard;
};

export type DesktopSignedUrlRequest = {
  platform: DesktopPlatform;
};

/** POST /api/admin/desktop-releases/signed-url — short-lived HTTPS GET to private S3. */
export type DesktopSignedUrlResponse = {
  platform: DesktopPlatform;
  downloadUrl: string;
  downloadUrlExpiresInSeconds: number;
};
