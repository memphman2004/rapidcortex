import { describe, expect, it, vi, beforeEach } from "vitest";

const { getActiveByIncident, recordEtaNotification, sendPreArrivalSms, auditCreate } = vi.hoisted(() => ({
  getActiveByIncident: vi.fn(),
  recordEtaNotification: vi.fn(),
  sendPreArrivalSms: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../session-store.js", () => ({
  preArrivalSessionStore: {
    getActiveByIncident,
  },
}));

vi.mock("./eta-session-store.js", () => ({
  recordEtaNotification,
}));

vi.mock("../sms.js", () => ({
  sendPreArrivalSms,
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreate;
  },
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    enablePreArrivalIq: true,
    preArrivalSessionsTable: "t",
  },
}));

vi.mock("rapid-cortex-security", () => ({
  AuthorizationService: class {},
  AUDIT_EVENT_TYPES: {
    PRE_ARRIVAL_ETA_SENT: "pre_arrival.eta.sent",
    PRE_ARRIVAL_ON_SCENE: "pre_arrival.eta.on_scene",
  },
}));

vi.mock("../../lib/auth.js", () => ({
  ACCOUNT_INACTIVE_MESSAGE: "inactive",
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(),
}));

import { processEtaEvent } from "./eta-notification-handler.js";

describe("processEtaEvent mock SMS path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendPreArrivalSms.mockResolvedValue({ ok: true, provider: "mock" });
    recordEtaNotification.mockResolvedValue(undefined);
    auditCreate.mockResolvedValue(undefined);
  });

  it("sends mock SMS and records ETA notification", async () => {
    getActiveByIncident.mockResolvedValue({
      sessionToken: "tokentoken12",
      agencyId: "ag-1",
      incidentId: "inc-1",
      status: "active",
      callerPhoneE164: "+15551234567",
      etaNotifications: [],
      responderStatus: "dispatched",
    });

    const result = await processEtaEvent({
      incidentId: "inc-1",
      agencyId: "ag-1",
      etaMinutes: 4,
      trigger: "dispatcher_manual",
    });

    expect(sendPreArrivalSms).toHaveBeenCalled();
    expect(recordEtaNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "ag-1",
        sessionToken: "tokentoken12",
        etaMinutes: 4,
      }),
    );
    expect(result.sent).toBe(true);
  });
});
