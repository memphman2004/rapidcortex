import { beforeEach, describe, expect, it, vi } from "vitest";

const { getByQrIdMock, incrementEngagementMock, agencyGetMock } = vi.hoisted(() => ({
  getByQrIdMock: vi.fn(),
  incrementEngagementMock: vi.fn(),
  agencyGetMock: vi.fn(),
}));

vi.mock("../repositories/qrNfcRepository.js", () => ({
  QrNfcRepository: class {
    getByQrId = getByQrIdMock;
    incrementEngagement = incrementEngagementMock;
    incrementSiteEngagement = vi.fn();
  },
}));

vi.mock("../repositories/agencyRepository.js", () => ({
  AgencyRepository: class {
    get = agencyGetMock;
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

vi.mock("./resolve-call-number.js", () => ({
  resolveAgencyCallNumber: vi.fn(async () => null),
}));

vi.mock("./qr-nfc-camera-bind.js", () => ({
  bindQrLocationCameras: vi.fn(),
}));

vi.mock("../campus/campus-building-from-qr.js", () => ({
  upsertCampusBuildingFromQr: vi.fn(),
}));

vi.mock("../lib/qr-generator.js", () => ({
  generateQRCodeBase64: vi.fn(),
  qrColorsForVertical: vi.fn(),
  qrNfcReportUrl: vi.fn(),
}));

import { QrNfcService } from "./qr-nfc-service.js";

describe("QrNfcService.engage campus infoTab", () => {
  beforeEach(() => {
    getByQrIdMock.mockReset();
    incrementEngagementMock.mockReset();
    agencyGetMock.mockReset();
    incrementEngagementMock.mockResolvedValue(undefined);
  });

  it("attaches site-specific public infoTab and defaults collectPhone true", async () => {
    getByQrIdMock.mockResolvedValue({
      qrId: "01HQRTEST0000000000000000",
      agencyId: "campus-a",
      agencyName: "Riverside College",
      name: "Library entrance",
      zoneName: "Building C",
      vertical: "campus",
      reportType: "anonymous",
      active: true,
      siteCode: "NORTH",
    });
    agencyGetMock.mockResolvedValue({
      agencyId: "campus-a",
      name: "Riverside College",
      config: {
        campus: {
          infoTab: { displayName: "Default Campus" },
          infoTabBySiteCode: {
            NORTH: {
              displayName: "North Annex",
              sections: [
                { title: "Hidden", content: "x", order: 0, visible: false },
                { title: "Evac", content: "Exit **north**.", order: 1, visible: true },
              ],
            },
          },
        },
      },
    });

    const svc = new QrNfcService();
    const out = await svc.engage("01HQRTEST0000000000000000", "qr");
    expect("active" in out && out.active).toBe(true);
    if (!("infoTab" in out)) throw new Error("expected public record");
    expect(out.infoTab?.displayName).toBe("North Annex");
    expect(out.infoTab?.sections).toHaveLength(1);
    expect(out.infoTab?.sections?.[0]?.title).toBe("Evac");
    expect(out.collectPhone).toBe(true);
  });
});
