import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getByQrIdMock,
  createIncidentMock,
  auditCreateMock,
  createInlineQrShareMock,
  allowMock,
} = vi.hoisted(() => ({
  getByQrIdMock: vi.fn(),
  createIncidentMock: vi.fn(),
  auditCreateMock: vi.fn(),
  createInlineQrShareMock: vi.fn(),
  allowMock: vi.fn(() => true),
}));

vi.mock("../../repositories/qrNfcRepository.js", () => ({
  QrNfcRepository: class {
    getByQrId = getByQrIdMock;
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreateMock;
  },
}));

vi.mock("../../qr-nfc/qr-nfc-incident-service.js", () => ({
  createIncidentFromQrNfcReport: (...a: unknown[]) => createIncidentMock(...a),
}));

vi.mock("../../services/pinpointService.js", () => ({
  PinpointService: class {
    createInlineQrShare = createInlineQrShareMock;
  },
}));

vi.mock("../../lib/publicRateLimiter.js", () => ({
  PublicBurstLimiter: class {
    allow = allowMock;
  },
}));

vi.mock("../../lib/correlation.js", () => ({
  withCorrelationHeaders: (_e: unknown, r: unknown) => r,
}));

import { handler } from "./publicReportSubmitHttp.js";

function event(body: unknown) {
  return {
    body: JSON.stringify(body),
    requestContext: { http: { sourceIp: "203.0.113.10" } },
  } as never;
}

describe("publicReportSubmitHttp campus live location", () => {
  beforeEach(() => {
    getByQrIdMock.mockReset();
    createIncidentMock.mockReset();
    auditCreateMock.mockReset();
    createInlineQrShareMock.mockReset();
    allowMock.mockReset();
    allowMock.mockReturnValue(true);
    auditCreateMock.mockResolvedValue(undefined);
    createIncidentMock.mockResolvedValue("inc_campusabc123");
  });

  it("rejects shareLiveLocation without phone on campus", async () => {
    getByQrIdMock.mockResolvedValue({
      qrId: "01HQRTEST0000000000000000",
      agencyId: "campus-a",
      vertical: "campus",
      active: true,
      reportType: "anonymous",
    });
    const res = await handler(
      event({
        qrId: "01HQRTEST0000000000000000",
        message: "Need help",
        medium: "qr",
        shareLiveLocation: true,
      }),
      {} as never,
      (() => undefined) as never,
    );
    expect(res?.statusCode).toBe(400);
    expect(createInlineQrShareMock).not.toHaveBeenCalled();
  });

  it("returns trackingToken when campus shareLiveLocation succeeds", async () => {
    getByQrIdMock.mockResolvedValue({
      qrId: "01HQRTEST0000000000000000",
      agencyId: "campus-a",
      vertical: "campus",
      active: true,
      reportType: "anonymous",
    });
    createInlineQrShareMock.mockResolvedValue({
      linkId: "ppl_1",
      token: "opaque-tracking-token",
      publicUrl: "https://app.example.test/pinpoint/t/opaque-tracking-token",
    });

    const res = await handler(
      event({
        qrId: "01HQRTEST0000000000000000",
        message: "Need help near library",
        medium: "qr",
        reporterPhone: "5551234567",
        shareLiveLocation: true,
      }),
      {} as never,
      (() => undefined) as never,
    );

    expect(res?.statusCode).toBe(201);
    const body = JSON.parse(String(res?.body ?? "{}")) as {
      trackingToken?: string;
      liveLocationToken?: string;
      referenceCode?: string;
    };
    expect(body.trackingToken).toBe("opaque-tracking-token");
    expect(body.liveLocationToken).toBe("opaque-tracking-token");
    expect(body.referenceCode).toBeTruthy();
    expect(createInlineQrShareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "campus-a",
        incidentId: "inc_campusabc123",
        consentGrantedAt: expect.any(String),
      }),
    );
  });

  it("keeps campus anonymous phone for callback / tracking", async () => {
    getByQrIdMock.mockResolvedValue({
      qrId: "01HQRTEST0000000000000000",
      agencyId: "campus-a",
      vertical: "campus",
      active: true,
      reportType: "anonymous",
    });
    createInlineQrShareMock.mockResolvedValue({
      linkId: "ppl_1",
      token: "tok",
      publicUrl: "/pinpoint/t/tok",
    });

    await handler(
      event({
        qrId: "01HQRTEST0000000000000000",
        message: "Help",
        medium: "qr",
        reporterPhone: "+15551234567",
        reporterName: "Should Drop",
        shareLiveLocation: true,
      }),
      {} as never,
      (() => undefined) as never,
    );

    expect(createIncidentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reporterPhone: "+15551234567",
        reporterName: undefined,
        shareLiveLocation: true,
      }),
    );
  });
});
