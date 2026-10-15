import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const {
  putMock,
  getMock,
  getByTokenHashMock,
  revokeIfActiveMock,
  appendPingIfActiveMock,
  auditCreateMock,
} = vi.hoisted(() => ({
  putMock: vi.fn(),
  getMock: vi.fn(),
  getByTokenHashMock: vi.fn(),
  revokeIfActiveMock: vi.fn(),
  appendPingIfActiveMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("../repositories/pinpointLinkRepository.js", () => ({
  PinpointLinkRepository: class {
    put = putMock;
    get = getMock;
    getByTokenHash = getByTokenHashMock;
    revokeIfActive = revokeIfActiveMock;
    appendPingIfActive = appendPingIfActiveMock;
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

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const TOKEN = "privacy-token-abcdefghijklmnopqrstuvwxyz";
const BASE_ROW = {
  linkId: "ppl_secret",
  tokenHash: hashToken(TOKEN),
  agencyId: "agency-secret",
  incidentId: "inc_secret",
  status: "active" as const,
  createdAt: "2026-10-14T11:00:00.000Z",
  updatedAt: "2026-10-14T11:00:00.000Z",
  expiresAt: "2099-10-14T13:00:00.000Z",
  pings: [
    { capturedAt: "2026-10-14T11:30:00.000Z", lat: 1, lng: 2, accuracyM: 10 },
    { capturedAt: "2026-10-14T11:31:00.000Z", lat: 1.1, lng: 2.1, accuracyM: 12 },
  ],
  callerPhoneE164: "+15551234567",
  channel: "browser" as const,
  consentGrantedAt: "2026-10-14T11:00:00.000Z",
  smsSentAt: null,
  smsProviderRef: null,
  ttl: 9999999999,
};

describe("Pinpoint public response privacy", () => {
  beforeEach(() => {
    putMock.mockReset();
    getMock.mockReset();
    getByTokenHashMock.mockReset();
    revokeIfActiveMock.mockReset();
    appendPingIfActiveMock.mockReset();
    auditCreateMock.mockReset();
    env.enablePinpoint = true;
    env.pinpointLinksTable = "pinpoint-links-table";
  });

  it("omits incidentId, linkId, agencyId, and full ping history from GET", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW });
    const svc = new PinpointService();
    const view = await svc.getPublicByToken(TOKEN);
    expect(view).toEqual({
      status: "active",
      expiresAt: BASE_ROW.expiresAt,
      sharingAllowed: true,
      updateCount: 2,
      lastAccepted: {
        capturedAt: "2026-10-14T11:31:00.000Z",
        lat: 1.1,
        lng: 2.1,
        accuracyM: 12,
      },
    });
    expect(JSON.stringify(view)).not.toMatch(/incidentId|linkId|agencyId|tokenHash|ppl_secret|inc_secret/);
  });

  it("returns a minimized public payload after GPS capture", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW, pings: [] });
    appendPingIfActiveMock.mockResolvedValue("accepted");
    const svc = new PinpointService();
    const view = await svc.captureLocation(TOKEN, { lat: 39.1, lng: -86.5, accuracyM: 15 });
    expect(view.sharingAllowed).toBe(true);
    expect(view.updateCount).toBe(1);
    expect(view.lastAccepted?.lat).toBe(39.1);
    expect((view as { incidentId?: string }).incidentId).toBeUndefined();
    expect((view as { linkId?: string }).linkId).toBeUndefined();
    expect((view as { pings?: unknown }).pings).toBeUndefined();
  });

  it("rejects capture when appendPingIfActive reports session_ended after revoke", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW, pings: [] });
    appendPingIfActiveMock.mockResolvedValue("session_ended");
    getMock.mockResolvedValue({ ...BASE_ROW, status: "revoked" });
    const svc = new PinpointService();
    await expect(
      svc.captureLocation(TOKEN, { lat: 1, lng: 2, accuracyM: 15 }),
    ).rejects.toThrow("SESSION_REVOKED");
  });

  it("rejects browser-channel capture when consentGrantedAt is missing", async () => {
    getByTokenHashMock.mockResolvedValue({
      ...BASE_ROW,
      pings: [],
      channel: "browser",
      consentGrantedAt: null,
    });
    const svc = new PinpointService();
    await expect(
      svc.captureLocation(TOKEN, { lat: 1, lng: 2, accuracyM: 15 }),
    ).rejects.toThrow(/consent/i);
    expect(appendPingIfActiveMock).not.toHaveBeenCalled();
  });

  it("records consent on first SMS-channel GPS accept", async () => {
    getByTokenHashMock.mockResolvedValue({
      ...BASE_ROW,
      pings: [],
      channel: "sms",
      consentGrantedAt: null,
    });
    appendPingIfActiveMock.mockResolvedValue("accepted");
    const svc = new PinpointService();
    await svc.captureLocation(TOKEN, { lat: 39.1, lng: -86.5, accuracyM: 15 });
    expect(appendPingIfActiveMock).toHaveBeenCalledWith(
      BASE_ROW.linkId,
      expect.objectContaining({ lat: 39.1, lng: -86.5 }),
      expect.any(Array),
      expect.objectContaining({ recordConsentAt: expect.any(String) }),
    );
  });
});
