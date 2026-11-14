import { describe, expect, it } from "vitest";
import type { AgencyConfig } from "rapid-cortex-shared";
import {
  assertAutomatedWritebackAllowed,
  assertHumanWritebackAllowed,
  resolveCadWritebackGates,
} from "./writeback-agency-gates.js";

function cfg(partial?: AgencyConfig["cadWriteback"]): AgencyConfig {
  return {
    agencyId: "a1",
    protocolPackId: "p",
    aiProviderProfileId: "ai",
    retentionPolicyId: "r",
    integrationMode: "bidirectional",
    transcriptRedactionEnabled: true,
    auditExportEnabled: true,
    environmentFlags: {},
    supervisorEscalationRules: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    cadWriteback: partial,
  };
}

describe("writeback-agency-gates", () => {
  it("defaults both flags to false", () => {
    expect(resolveCadWritebackGates(undefined)).toEqual({
      cadAddendumSigned: false,
      cadAutomatedWritebackEnabled: false,
    });
    expect(assertHumanWritebackAllowed(cfg()).ok).toBe(false);
    expect(assertAutomatedWritebackAllowed(cfg()).ok).toBe(false);
  });

  it("allows human path only when addendum is signed", () => {
    expect(assertHumanWritebackAllowed(cfg({ cadAddendumSigned: true, cadAutomatedWritebackEnabled: false })).ok).toBe(
      true,
    );
    expect(assertAutomatedWritebackAllowed(cfg({ cadAddendumSigned: true, cadAutomatedWritebackEnabled: false })).ok).toBe(
      false,
    );
  });

  it("allows automated path only when both flags are true", () => {
    expect(
      assertAutomatedWritebackAllowed(
        cfg({ cadAddendumSigned: true, cadAutomatedWritebackEnabled: true }),
      ).ok,
    ).toBe(true);
  });
});
