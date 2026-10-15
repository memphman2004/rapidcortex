import { describe, expect, it } from "vitest";
import { CAD_VENDOR_IDS } from "rapid-cortex-shared";
import { MotorolaPremierOneAdapter } from "../adapters/MotorolaPremierOneAdapter.js";
import { TylerNewWorldAdapter } from "../adapters/TylerNewWorldAdapter.js";
import { HexagonIntergraphAdapter } from "../adapters/HexagonIntergraphAdapter.js";
import { CentralSquareAdapter } from "../adapters/CentralSquareAdapter.js";
import { SpillmanAdapter } from "../adapters/SpillmanAdapter.js";
import { Mark43Adapter } from "../adapters/Mark43Adapter.js";
import { CaliberAdapter } from "../adapters/CaliberAdapter.js";
import { VersatermAdapter } from "../adapters/VersatermAdapter.js";
import { RapidDeployAdapter } from "../adapters/RapidDeployAdapter.js";
import { ZetronAdapter } from "../adapters/ZetronAdapter.js";
import { EforceAdapter } from "../adapters/EforceAdapter.js";
import { CodyAdapter } from "../adapters/CodyAdapter.js";
import { SunridgeRimsAdapter } from "../adapters/SunridgeRimsAdapter.js";
import { KabatOneAdapter } from "../adapters/KabatOneAdapter.js";
import { OraclePsdcAdapter } from "../adapters/OraclePsdcAdapter.js";
import { GenericRestAdapter } from "../adapters/GenericRestAdapter.js";
import { CadAdapterRegistry } from "../adapters/CadAdapterRegistry.js";

const EXPECTED: Record<string, new () => unknown> = {
  motorola_premierone: MotorolaPremierOneAdapter,
  tyler_new_world: TylerNewWorldAdapter,
  hexagon_intergraph: HexagonIntergraphAdapter,
  central_square: CentralSquareAdapter,
  spillman: SpillmanAdapter,
  mark43: Mark43Adapter,
  caliber: CaliberAdapter,
  versaterm: VersatermAdapter,
  rapiddeploy: RapidDeployAdapter,
  zetron: ZetronAdapter,
  eforce: EforceAdapter,
  cody: CodyAdapter,
  sunridge_rims: SunridgeRimsAdapter,
  kabat_one: KabatOneAdapter,
  oracle_psdc: OraclePsdcAdapter,
  generic_rest: GenericRestAdapter,
};

describe("CadAdapterRegistry", () => {
  it("resolves every supported vendor id from shared CAD_VENDOR_IDS", () => {
    for (const vendorId of CAD_VENDOR_IDS) {
      const adapter = CadAdapterRegistry.resolve(vendorId);
      expect(adapter).toBeInstanceOf(EXPECTED[vendorId]);
      expect(adapter.vendorId).toBe(vendorId);
    }
  });

  it("throws for an unknown vendor id", () => {
    expect(() => CadAdapterRegistry.resolve("not_a_vendor")).toThrow(/No adapter registered/);
  });
});
