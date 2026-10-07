import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetOverview, mockIssueSignedUrl, mockAssert } = vi.hoisted(() => ({
  mockGetOverview: vi.fn(),
  mockIssueSignedUrl: vi.fn(),
  mockAssert: vi.fn(),
}));

vi.mock("../../services/desktopReleaseService.js", () => ({
  DesktopReleaseService: vi.fn().mockImplementation(() => ({
    assertCanDownloadDesktopInstallers: mockAssert,
    getOverview: mockGetOverview,
    issueSignedUrl: mockIssueSignedUrl,
  })),
}));

import { handler as getOverviewHandler } from "./getDesktopReleasesOverview.js";
import { handler as postSignedUrlHandler } from "./postDesktopReleaseSignedUrl.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

const sampleOverview = {
  macos: {
    platform: "macos" as const,
    available: true,
    version: "1.0.0",
    releasedAt: "2026-01-01T00:00:00.000Z",
    minOSVersion: "13.0",
    fileBytes: 1000,
    sha256: "abc",
    artifactFileName: "RapidCortex-1.0.0.dmg",
    installationNotes: "notes",
  },
  windows: {
    platform: "windows" as const,
    available: false,
    version: "1.0.0",
    releasedAt: null,
    minOSVersion: "Windows 10",
    fileBytes: null,
    sha256: null,
    artifactFileName: "RapidCortexSetup.exe",
    installationNotes: "win",
  },
};

describe("desktop releases handlers", () => {
  beforeEach(() => {
    mockGetOverview.mockReset();
    mockIssueSignedUrl.mockReset();
    mockAssert.mockReset();
    mockAssert.mockImplementation(() => {});
  });

  it("GET overview returns 403 for dispatcher", async () => {
    mockAssert.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
    const res = await invokeHttpHandler(
      getOverviewHandler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        rawPath: "/api/admin/desktop-releases",
        routeKey: "GET /api/admin/desktop-releases",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("GET overview returns 200 for agencyit", async () => {
    mockGetOverview.mockResolvedValue(sampleOverview);
    const res = await invokeHttpHandler(
      getOverviewHandler,
      makeAuthenticatedEvent({
        role: "agencyit",
        agencyId: "agency-a",
        rawPath: "/api/admin/desktop-releases",
        routeKey: "GET /api/admin/desktop-releases",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as typeof sampleOverview;
    expect(body.macos.available).toBe(true);
  });

  it("POST signed-url returns 403 for supervisor", async () => {
    mockIssueSignedUrl.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await invokeHttpHandler(
      postSignedUrlHandler,
      makeAuthenticatedEvent({
        role: "commsupervisor",
        agencyId: "agency-a",
        rawPath: "/api/admin/desktop-releases/signed-url",
        routeKey: "POST /api/admin/desktop-releases/signed-url",
        body: JSON.stringify({ platform: "macos" }),
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("POST signed-url returns url for admin", async () => {
    mockIssueSignedUrl.mockResolvedValue({
      platform: "macos",
      downloadUrl: "https://example.invalid/signed",
      downloadUrlExpiresInSeconds: 300,
    });
    const res = await invokeHttpHandler(
      postSignedUrlHandler,
      makeAuthenticatedEvent({
        role: "agencyadmin",
        agencyId: "agency-a",
        rawPath: "/api/admin/desktop-releases/signed-url",
        routeKey: "POST /api/admin/desktop-releases/signed-url",
        body: JSON.stringify({ platform: "macos" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { downloadUrl: string };
    expect(body.downloadUrl).toContain("https://");
  });
});
