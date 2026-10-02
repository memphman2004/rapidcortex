import { describe, expect, it, vi, beforeEach } from "vitest";
import { MISSOURI_SUNSHINE_RETENTION_POLICY } from "rapid-cortex-shared";

const { listTenantConfigs, listSessions, deleteSurvey, deleteSessionIfNotOnLegalHold, putSession, putConfig } = vi.hoisted(
  () => ({
    listTenantConfigs: vi.fn(),
    listSessions: vi.fn(),
    deleteSurvey: vi.fn(),
    deleteSessionIfNotOnLegalHold: vi.fn(),
    putSession: vi.fn(),
    putConfig: vi.fn(),
  }),
);

vi.mock("../call-assist/store.js", () => ({
  callAssistStore: {
    listTenantConfigs,
    listSessions,
    deleteSurvey,
    deleteSessionIfNotOnLegalHold,
    putSession,
    putConfig,
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

vi.mock("../lib/env.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/env.js")>();
  return { env: { ...mod.env, callAssistTable: "test-call-assist" } };
});

import { processCallAssistRetentionPass } from "./callAssistRetention.js";

describe("Call Assist retention executor", () => {
  beforeEach(() => {
    listTenantConfigs.mockReset();
    listSessions.mockReset();
    deleteSurvey.mockReset();
    deleteSessionIfNotOnLegalHold.mockReset();
    putSession.mockReset();
    putConfig.mockReset();
  });

  it("redacts by data type and skips legal hold", async () => {
    const old = new Date(Date.now() - 4000 * 86_400_000).toISOString();
    listTenantConfigs.mockResolvedValue([
      {
        agencyId: "kcpd",
        retention: {
          ...MISSOURI_SUNSHINE_RETENTION_POLICY,
          audioRetentionDays: 1,
          transcriptRetentionDays: 1,
          intakeDataRetentionDays: 9999,
          analyticsRetentionDays: 9999,
        },
      },
    ]);
    listSessions.mockResolvedValue([
      {
        agencyId: "kcpd",
        sessionId: "hold",
        createdAt: old,
        legalHold: true,
        utterances: [{ speaker: "caller", text: "hello" }],
      },
      {
        agencyId: "kcpd",
        sessionId: "purge",
        createdAt: old,
        legalHold: false,
        utterances: [{ speaker: "caller", text: "hello" }],
      },
    ]);
    deleteSessionIfNotOnLegalHold.mockResolvedValue(true);
    const out = await processCallAssistRetentionPass();
    expect(out.skippedLegalHold).toBe(1);
    expect(out.transcriptsRedacted).toBeGreaterThanOrEqual(1);
    expect(putConfig).toHaveBeenCalled();
  });
});
