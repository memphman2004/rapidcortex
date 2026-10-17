import { beforeEach, describe, expect, it, vi } from "vitest";

const updateFields = vi.fn();
const getActiveByIncident = vi.fn();
const writeAudit = vi.fn();

vi.mock("../session-store.js", () => ({
  preArrivalSessionStore: {
    getActiveByIncident: (...args: unknown[]) => getActiveByIncident(...args),
    updateFields: (...args: unknown[]) => updateFields(...args),
  },
}));

vi.mock("./audit-log.js", () => ({
  ReconciliationAuditLog: class {
    write = writeAudit;
    static computeHash() {
      return "a".repeat(32);
    }
  },
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    protocolCompatibilityTable: "",
    enablePreArrivalIq: true,
    preArrivalSessionsTable: "rapid-cortex-pre-arrival-sessions-test",
  },
}));

import { ProtocolReconciliationEngine } from "./engine.js";

describe("ProtocolReconciliationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("terminates session on restricted nature", async () => {
    getActiveByIncident.mockResolvedValue({
      sessionToken: "tokentoken12",
      agencyId: "ag-1",
      incidentId: "inc-1",
      status: "active",
      cadNatureCode: "CHEST_PAIN",
      activeSteps: [],
      instructions: [],
      responderStatus: "dispatched",
      modePolicy: { showInstructions: true, stayOnLine: false },
    });

    const engine = new ProtocolReconciliationEngine();
    const result = await engine.reconcile({
      incidentId: "inc-1",
      agencyId: "ag-1",
      dispatcherId: "disp-1",
      priorNatureCode: "CHEST_PAIN",
      newNatureCode: "ACTIVE_SHOOTER",
      timestamp: "2026-01-01T00:00:00.000Z",
      source: "test",
    });

    expect(result?.sessionTerminated).toBe(true);
    expect(updateFields).toHaveBeenCalledWith(
      "ag-1",
      "tokentoken12",
      expect.objectContaining({ status: "terminated" }),
    );
  });

  it("suspends incompatible steps and replaces protocol", async () => {
    getActiveByIncident.mockResolvedValue({
      sessionToken: "tokentoken12",
      agencyId: "ag-1",
      incidentId: "inc-1",
      status: "active",
      cadNatureCode: "CHEST_PAIN",
      activeSteps: [
        {
          stepId: "s1",
          protocolId: "CHEST_v1",
          cadNatureCode: "CHEST_PAIN",
          order: 1,
          category: "COMMUNICATION",
          text: "Stay on the line",
          status: "ACTIVE",
          activatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          stepId: "s2",
          protocolId: "CHEST_v1",
          cadNatureCode: "CHEST_PAIN",
          order: 2,
          category: "CPR",
          text: "Start CPR",
          status: "ACTIVE",
          activatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      instructions: [],
      responderStatus: "dispatched",
      modePolicy: { showInstructions: true, stayOnLine: false },
    });

    const engine = new ProtocolReconciliationEngine();
    const result = await engine.reconcile({
      incidentId: "inc-1",
      agencyId: "ag-1",
      dispatcherId: "disp-1",
      priorNatureCode: "CHEST_PAIN",
      newNatureCode: "CARDIAC_ARREST",
      timestamp: "2026-01-01T00:00:00.000Z",
      source: "test",
    });

    expect(result?.sessionTerminated).toBe(false);
    expect(result?.suspendedSteps.some((s) => s.category === "CPR")).toBe(true);
    expect(result?.suspendedSteps.some((s) => s.category === "COMMUNICATION")).toBe(false);
    expect(updateFields).toHaveBeenCalled();
  });
});
