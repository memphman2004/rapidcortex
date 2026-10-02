import { describe, expect, it } from "vitest";
import {
  buildMediaDedupe,
  buildRetentionFields,
  buildRetentionGsiSk,
  resolveDaysForType,
  resolvePolicyId,
  resolveEnvRetentionDefaults,
  retentionQueryUpperBoundSk,
} from "../lib/retentionPolicy.js";

const envBase = {
  defaultRetentionPolicyId: "tpol",
  retentionIncidentDaysDefault: 2555,
  retentionTranscriptDaysDefault: 1095,
  retentionMediaDaysDefault: 365,
  retentionAnalysisDaysDefault: 1095,
} as const;

describe("retention policy helpers", () => {
  it("resolves per-type defaults from env", () => {
    expect(resolveDaysForType("incident", undefined, envBase)).toBe(2555);
    expect(resolveDaysForType("transcript", undefined, envBase)).toBe(1095);
    expect(resolveDaysForType("media", undefined, envBase)).toBe(365);
    const d = resolveEnvRetentionDefaults(envBase);
    expect(d.incident).toBe(2555);
  });

  it("applies agency overrides", () => {
    const days = resolveDaysForType(
      "incident",
      {
        agencyId: "x",
        protocolPackId: "p",
        aiProviderProfileId: "a",
        retentionPolicyId: "p1",
        integrationMode: "none",
        transcriptRedactionEnabled: true,
        auditExportEnabled: false,
        environmentFlags: {},
        retentionOverrideDays: { incident: 30 },
        supervisorEscalationRules: {},
        createdAt: "",
        updatedAt: "",
      },
      envBase,
    );
    expect(days).toBe(30);
  });

  it("builds GSI sk ordered by retention expiry and computes expires from anchor", () => {
    const r = buildRetentionFields("transcript", {
      agencyConfig: undefined,
      anchorIso: "2020-01-01T00:00:00.000Z",
      policyId: "tpol",
      dedupe: "tr#i1#2020-01-01T00:00:00.000Z",
      envDefaults: { ...envBase, defaultRetentionPolicyId: "tpol" },
    });
    expect(r.retGsiSk).toBe(buildRetentionGsiSk(r.retentionExpiresAt, "tr#i1#2020-01-01T00:00:00.000Z"));
    const expMs = new Date("2020-01-01T00:00:00.000Z").getTime() + 1095 * 86_400_000;
    expect(new Date(r.retentionExpiresAt).getTime()).toBe(expMs);
  });

  it("produces a query upper bound for lexicographic ISO key comparison", () => {
    const d = new Date("2025-06-15T12:00:00.000Z");
    const max = retentionQueryUpperBoundSk(d);
    expect(max.startsWith("2025-06-15T12:00:00.000Z")).toBe(true);
  });

  it("uses config retention id when set", () => {
    expect(
      resolvePolicyId(
        {
          agencyId: "a",
          protocolPackId: "p",
          aiProviderProfileId: "a",
          retentionPolicyId: "from-config",
          integrationMode: "none",
          transcriptRedactionEnabled: true,
          auditExportEnabled: false,
          environmentFlags: {},
          supervisorEscalationRules: {},
          createdAt: "",
          updatedAt: "",
        },
        "fallback",
      ),
    ).toBe("from-config");
  });

  it("buildMediaDedupe is stable for keys", () => {
    expect(buildMediaDedupe("a1", "m2")).toBe("md#a1#m2");
  });
});
