import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendSmsMock, putMock, getIncidentMock, agencyGetMock } = vi.hoisted(() => ({
  sendSmsMock: vi.fn(),
  putMock: vi.fn(),
  getIncidentMock: vi.fn(),
  agencyGetMock: vi.fn(),
}));

vi.mock("./sms/smsProviderFactory.js", () => ({ sendIncidentMediaLinkSms: sendSmsMock }));
vi.mock("../repositories/incidentMediaRepository.js", () => ({
  IncidentMediaRepository: class {
    put = putMock;
  },
}));
vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    get = getIncidentMock;
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

import { env } from "../lib/env.js";
import { MediaService } from "./mediaService.js";

describe("MediaService SMS routing", () => {
  beforeEach(() => {
    sendSmsMock.mockReset();
    putMock.mockReset();
    getIncidentMock.mockReset();
    agencyGetMock.mockReset();
    agencyGetMock.mockResolvedValue({ agencyId: "agency-a", config: {} });
  });

  it("sends with messageType media_upload", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "m1",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    const svc = new MediaService();
    await svc.requestMedia("inc-1", { userId: "u1", role: "dispatcher", agencyId: "agency-a" } as never, {
      callerPhoneE164: "+15555550100",
    });
    expect(sendSmsMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ messageType: "media_upload" }),
    );
    expect(putMock).toHaveBeenCalled();
    const row = putMock.mock.calls[0]![0];
    expect(row.smsFailoverUsed).toBe(false);
  });

  it("passes aws SMS mode into the factory when env selects aws", async () => {
    const prev = env.smsProvider;
    env.smsProvider = "aws";
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "sns-xyz",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
    });
    try {
      const svc = new MediaService();
      await svc.requestMedia("inc-1", { userId: "u1", role: "dispatcher", agencyId: "agency-a" } as never, {
        callerPhoneE164: "+15555550100",
      });
      expect(sendSmsMock.mock.calls[0]![0].smsProvider).toBe("aws");
    } finally {
      env.smsProvider = prev;
    }
  });
});
