import { describe, expect, it, vi, beforeEach } from "vitest";

const { getSession, putSession, putSelfServiceToken, getSelfServiceToken } = vi.hoisted(() => ({
  getSession: vi.fn(),
  putSession: vi.fn(),
  putSelfServiceToken: vi.fn(),
  getSelfServiceToken: vi.fn(),
}));

const { fileCallAssistRms } = vi.hoisted(() => ({
  fileCallAssistRms: vi.fn(async () => ({ ok: true, blocked: false, reason: "demo_mock_rms" })),
}));

vi.mock("./store.js", () => ({
  callAssistStore: {
    getSession,
    putSession,
    putSelfServiceToken,
    getSelfServiceToken,
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

vi.mock("./rms/rms-file.js", () => ({
  fileCallAssistRms,
}));

vi.mock("../lib/smsFactoryEnv.js", () => ({
  buildSmsFactoryEnvForAgency: vi.fn(async () => ({})),
}));

vi.mock("../services/sms/smsProviderFactory.js", () => ({
  sendIncidentMediaLinkSms: vi.fn(async () => ({
    status: "sent",
    provider: "mock",
    messageId: "m1",
  })),
}));

import { completeSelfService, markSelfServiceOpened } from "./sms-self-service.js";

const session = {
  agencyId: "kcpd",
  sessionId: "cas_1",
  state: "INTAKE" as const,
  utterances: [],
  intake: {},
  smsSelfService: {
    token: "tok_live_token_16",
    status: "SENT" as const,
    portalUrl: "https://reports.example.gov",
  },
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("Call Assist SMS self-service token", () => {
  beforeEach(() => {
    getSelfServiceToken.mockReset();
    getSession.mockReset();
    putSession.mockReset();
    fileCallAssistRms.mockClear();
    getSelfServiceToken.mockResolvedValue({
      token: "tok_live_token_16",
      agencyId: "kcpd",
      sessionId: "cas_1",
      portalUrl: "https://reports.example.gov",
    });
    getSession.mockResolvedValue({ ...session, smsSelfService: { ...session.smsSelfService } });
  });

  it("marks a sent link as clicked on first open", async () => {
    const next = await markSelfServiceOpened("tok_live_token_16");
    expect(next?.smsSelfService?.status).toBe("CLICKED");
    expect(putSession).toHaveBeenCalled();
    expect(fileCallAssistRms).not.toHaveBeenCalled();
  });

  it("hands completed reports to RMS filing", async () => {
    getSession.mockResolvedValue({
      ...session,
      smsSelfService: { ...session.smsSelfService, status: "CLICKED" },
    });
    const next = await completeSelfService({ token: "tok_live_token_16", disposition: "completed" });
    expect(next.smsSelfService?.status).toBe("COMPLETED");
    expect(fileCallAssistRms).toHaveBeenCalled();
  });
});
