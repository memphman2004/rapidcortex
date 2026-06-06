import { afterEach, describe, expect, it } from "vitest";
import { CadAdapterFactory, readCadConnectionConfig } from "@/lib/rapid-cortex/cad/cad-adapter-factory";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("CadAdapterFactory", () => {
  it("selects mock adapter when vendor is mock", async () => {
    process.env.CAD_VENDOR = "mock";
    process.env.RAPID_CORTEX_CAD_MODE = "assisted_writeback";
    const config = readCadConnectionConfig("agency-a");
    const adapter = new CadAdapterFactory().create(config);
    const health = await adapter.healthCheck();
    expect(health.vendor).toBe("mock");
  });

  it("returns safe not-configured behavior for unconfigured vendors", async () => {
    process.env.CAD_VENDOR = "motorola";
    process.env.RAPID_CORTEX_CAD_MODE = "assisted_writeback";
    const config = readCadConnectionConfig("agency-a");
    const adapter = new CadAdapterFactory().create(config);
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.error?.code).toBe("NOT_CONFIGURED");
  });
});
