import { beforeEach, describe, expect, it, vi } from "vitest";

const { putMock, auditCreateMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("../repositories/pinpointLinkRepository.js", () => ({
  PinpointLinkRepository: class {
    put = putMock;
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreateMock;
  },
}));

vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {},
}));

vi.mock("../lib/incidentReadAccess.js", () => ({
  resolveIncidentRead: vi.fn(),
}));

vi.mock("./sms/smsProviderFactory.js", () => ({
  sendIncidentMediaLinkSms: vi.fn(),
}));

import { env } from "../lib/env.js";
import { PinpointService } from "./pinpointService.js";

describe("PinpointService.createInlineQrShare", () => {
  beforeEach(() => {
    putMock.mockReset();
    auditCreateMock.mockReset();
    putMock.mockImplementation(async (item: unknown) => item);
    auditCreateMock.mockResolvedValue(undefined);
    env.enablePinpoint = true;
    env.pinpointLinksTable = "pinpoint-links-table";
    env.pinpointPublicBaseUrl = "https://app.example.test";
  });

  it("creates a browser-channel link without SMS and stores consent", async () => {
    const svc = new PinpointService();
    const out = await svc.createInlineQrShare({
      agencyId: "campus-a",
      incidentId: "inc_campus_1",
      rcli: "01HQRTEST",
      callerPhoneE164: "+15551234567",
      consentGrantedAt: "2026-10-14T12:00:00.000Z",
    });

    expect(out).not.toBeNull();
    expect(out!.token.length).toBeGreaterThan(20);
    expect(out!.publicUrl).toContain("/pinpoint/t/");
    expect(putMock).toHaveBeenCalledTimes(1);
    const row = putMock.mock.calls[0]![0] as {
      channel?: string;
      consentGrantedAt?: string;
      callerPhoneE164?: string;
      smsSentAt?: string | null;
    };
    expect(row.channel).toBe("browser");
    expect(row.consentGrantedAt).toBe("2026-10-14T12:00:00.000Z");
    expect(row.callerPhoneE164).toBe("+15551234567");
    expect(row.smsSentAt).toBeNull();
  });

  it("returns null when Pinpoint is disabled (non-fatal for intake)", async () => {
    env.enablePinpoint = false;
    const svc = new PinpointService();
    const out = await svc.createInlineQrShare({
      agencyId: "campus-a",
      incidentId: "inc_campus_1",
    });
    expect(out).toBeNull();
    expect(putMock).not.toHaveBeenCalled();
  });
});
