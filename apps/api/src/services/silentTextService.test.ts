import { beforeEach, describe, expect, it, vi } from "vitest";

const { getIncidentMock, putMock, getMock, listByIncidentMock, auditCreateMock, sendSmsMock } =
  vi.hoisted(() => ({
    getIncidentMock: vi.fn(),
    putMock: vi.fn(),
    getMock: vi.fn(),
    listByIncidentMock: vi.fn(),
    auditCreateMock: vi.fn(),
    sendSmsMock: vi.fn(),
  }));

vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    get = getIncidentMock;
  },
}));

vi.mock("../repositories/silentTextRepository.js", () => ({
  SilentTextRepository: class {
    put = putMock;
    get = getMock;
    listByIncident = listByIncidentMock;
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreateMock;
  },
}));

vi.mock("../repositories/transcriptRepository.js", () => ({
  TranscriptRepository: class {},
}));

vi.mock("../lib/silentTextSms.js", () => ({
  sendSilentTextSms: (...a: unknown[]) => sendSmsMock(...a),
}));

import { env } from "../lib/env.js";
import { SilentTextService } from "./silentTextService.js";

describe("SilentTextService enable gate", () => {
  beforeEach(() => {
    getIncidentMock.mockReset();
    putMock.mockReset();
    getMock.mockReset();
    listByIncidentMock.mockReset();
    auditCreateMock.mockReset();
    sendSmsMock.mockReset();
    env.enableSilentText = true;
    env.silentTextTable = "silent-text-table";
    env.silentTextPublicBaseUrl = "https://app.example.test";
  });

  it("rejects create when ENABLE_SILENT_TEXT is off", async () => {
    env.enableSilentText = false;
    const svc = new SilentTextService();
    await expect(
      svc.createSession(
        "inc-1",
        { userId: "u-1", role: "dispatcher", agencyId: "agency-a", email: "d@a.test" } as never,
        { callerPhoneE164: "+15555550100" },
      ),
    ).rejects.toThrow("SILENT_TEXT_DISABLED");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("creates a session and sends SMS when enabled", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      ok: true,
      provider: "aws",
      providerRef: "msg-1",
    });
    putMock.mockImplementation(async (item: unknown) => item);
    const svc = new SilentTextService();
    const out = await svc.createSession(
      "inc-1",
      { userId: "u-1", role: "dispatcher", agencyId: "agency-a", email: "d@a.test" } as never,
      { callerPhoneE164: "+15555550100" },
    );
    expect(out.session.status).toBe("sms_sent");
    expect(sendSmsMock).toHaveBeenCalled();
    expect(putMock).toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalled();
  });
});
