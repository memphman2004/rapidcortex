/**
 * Token and public-link abuse controls:
 * - Opaque media tokens must map 1:1 to a row; wrong or invalid tokens fail closed.
 * - Row expiry is enforced before metadata / upload paths.
 * - Upload confirm rejects presigned key tampering (different object path than issued for that token).
 * - Second use of upload URL after successful upload: issueUploadUrl returns 409 (already uploaded).
 * - Distributed / automated abuse: pair with WAF, usage plans, and `PublicBurstLimiter` (see rate-limiting tests);
 *   an on-call “high reuse” alert is an ops/observability concern (SNS, metrics on 429) — not asserted here.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getIncidentMediaPublicMetaHandler, getUploadUrlHandler } from "../../handlers/media/getUploadUrl.js";
import { MediaService } from "../../services/mediaService.js";
import { TEST_AGENCY_A } from "../fixtures/multi-tenant-setup.js";

const { mockGetByHash, mockMediaPut } = vi.hoisted(() => ({
  mockGetByHash: vi.fn(),
  mockMediaPut: vi.fn(),
}));

vi.mock("../../repositories/incidentMediaRepository.js", () => ({
  IncidentMediaRepository: class {
    getByTokenHash = mockGetByHash;
    put = mockMediaPut;
  },
}));

function tokenHash(t: string): string {
  return createHash("sha256").update(t, "utf8").digest("hex");
}

function baseRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    agencyId: TEST_AGENCY_A,
    mediaId: "m1",
    incidentId: "inc1",
    tokenHash: "h",
    status: "pending" as const,
    callerPhoneE164: "+10000000000",
    requestedByUserId: "u1",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ttl: Math.floor(Date.now() / 1000) + 8_000,
    ...overrides,
  };
}

/** Token that satisfies public route validation (length + charset). */
const OPAQUE = "A".repeat(32);

describe("public / token abuse", () => {
  beforeEach(() => {
    mockGetByHash.mockReset();
    mockMediaPut.mockReset();
  });

  it("rejects incident media public meta for unknown token (no row)", async () => {
    mockGetByHash.mockImplementation((h: string) => {
      expect(h).toBe(tokenHash(OPAQUE));
      return null;
    });
    const res = await getIncidentMediaPublicMetaHandler({
      version: "2.0",
      routeKey: "GET /api/public/incident-media/t/{token}",
      rawPath: "/api/public/incident-media/t/t",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      pathParameters: { token: OPAQUE },
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects incident media public meta when link is past expiresAt (410)", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    mockGetByHash.mockReturnValue(
      baseRow({
        expiresAt: past,
        createdAt: past,
        updatedAt: past,
        tokenHash: tokenHash(OPAQUE),
      }),
    );
    const res = await getIncidentMediaPublicMetaHandler({
      version: "2.0",
      routeKey: "GET /api/public/incident-media/t/{token}",
      rawPath: "/api/public/incident-media/t/t",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      pathParameters: { token: OPAQUE },
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(410);
  });

  it("confirm upload rejects s3 key that does not match the media row (anti path tampering)", async () => {
    const svc = new MediaService();
    const row = baseRow({
      status: "upload_url_issued" as const,
      tokenHash: tokenHash(OPAQUE),
      s3Key: `incident-media/${TEST_AGENCY_A}/inc1/m1/good-name.pdf`,
    });
    mockGetByHash.mockReturnValue(row);
    await expect(
      svc.confirmUpload(OPAQUE, {
        s3Key: `incident-media/${TEST_AGENCY_A}/other-inc/m1/malware.pdf`,
        contentType: "application/pdf",
        byteSize: 10,
      }),
    ).rejects.toMatchObject({ message: "S3_KEY_MISMATCH" });
  });

  it("blocks a second presigned upload URL when media is already uploaded (token reuse for upload path)", async () => {
    const now = new Date().toISOString();
    const row = baseRow({
      status: "uploaded" as const,
      tokenHash: tokenHash(OPAQUE),
      s3Key: `incident-media/${TEST_AGENCY_A}/inc1/m1/f.pdf`,
      createdAt: now,
      updatedAt: now,
    });
    mockGetByHash.mockReturnValue(row);
    const res = await getUploadUrlHandler({
      version: "2.0",
      routeKey: "POST /api/public/incident-media/t/{token}/upload-url",
      rawPath: "/x",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      pathParameters: { token: OPAQUE },
      body: JSON.stringify({
        fileName: "a.pdf",
        contentType: "application/pdf",
        byteSize: 1000,
        consent: { consentVersion: "v1" },
      }),
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(409);
  });
});
