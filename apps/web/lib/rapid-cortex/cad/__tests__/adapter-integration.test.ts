/**
 * G2 — CAD integration safety (read scope, in-process):
 * Read-only bridged adapter returns deterministic staging payloads; writes are blocked;
 * disabled mode fails closed on reads. Complements `staging-cad-read-adapter.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgedCadReadAdapter } from "../bridged-cad-read-adapter";
import { resolveCadAdapter } from "../CadAdapterFactory";
import { DisabledCadReadAdapter } from "../disabled-cad-read-adapter";
import { StagingCadReadAdapter } from "../staging-cad-read-adapter";

describe("G2: CAD adapter integration (read-only / disabled)", () => {
  const prevMode = process.env.CAD_INTEGRATION_MODE;
  const prevVendor = process.env.CAD_VENDOR_NAME;

  beforeEach(() => {
    delete process.env.CAD_WRITEBACK_ENABLED;
  });

  afterEach(() => {
    if (prevMode === undefined) delete process.env.CAD_INTEGRATION_MODE;
    else process.env.CAD_INTEGRATION_MODE = prevMode;
    if (prevVendor === undefined) delete process.env.CAD_VENDOR_NAME;
    else process.env.CAD_VENDOR_NAME = prevVendor;
  });

  it("read_only + default vendor resolves staging-backed incident", async () => {
    process.env.CAD_INTEGRATION_MODE = "read_only";
    process.env.CAD_VENDOR_NAME = "";
    const adapter = resolveCadAdapter();
    const inc = await adapter.getIncident("staging-inc-e01");
    expect(inc.incidentId).toBe("staging-inc-e01");
    expect(inc.status ?? inc.callType).toBeTruthy();
  });

  it("searchIncidents returns non-empty array in read_only staging mode", async () => {
    process.env.CAD_INTEGRATION_MODE = "read_only";
    process.env.CAD_VENDOR_NAME = "";
    const adapter = resolveCadAdapter();
    const rows = await adapter.searchIncidents({
      from: "2020-01-01T00:00:00.000Z",
      to: "2030-12-31T23:59:59.999Z",
    });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("BridgedCadReadAdapter blocks draft write-back", async () => {
    const bridged = new BridgedCadReadAdapter(new StagingCadReadAdapter());
    await expect(
      bridged.createDraftUpdate({
        incidentId: "staging-inc-e01",
        summary: "x",
        fields: {},
        source: "dispatcher",
      }),
    ).rejects.toThrow(/write-back is disabled|read-only/i);
  });

  it("disabled CAD mode throws on getIncident (no silent live reads)", async () => {
    process.env.CAD_INTEGRATION_MODE = "disabled";
    const adapter = resolveCadAdapter();
    await expect(adapter.getIncident("any")).rejects.toThrow(/disabled|CAD integration is disabled/i);
  });

  it("healthCheck reports not-ok when read provider is disabled", async () => {
    process.env.CAD_INTEGRATION_MODE = "read_only";
    process.env.CAD_VENDOR_NAME = "";
    const bridged = new BridgedCadReadAdapter(new DisabledCadReadAdapter());
    const h = await bridged.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.mode).toBe("disabled");
  });

  it("CAD_WRITEBACK_ENABLED is unset in test env (pilot default)", () => {
    expect(process.env.CAD_WRITEBACK_ENABLED).toBeUndefined();
  });
});
