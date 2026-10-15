import type { CadAdapter } from "../adapter/CadAdapter.js";
import { MotorolaPremierOneAdapter } from "./MotorolaPremierOneAdapter.js";
import { TylerNewWorldAdapter } from "./TylerNewWorldAdapter.js";
import { HexagonIntergraphAdapter } from "./HexagonIntergraphAdapter.js";
import { CentralSquareAdapter } from "./CentralSquareAdapter.js";
import { SpillmanAdapter } from "./SpillmanAdapter.js";
import { Mark43Adapter } from "./Mark43Adapter.js";
import { CaliberAdapter } from "./CaliberAdapter.js";
import { VersatermAdapter } from "./VersatermAdapter.js";
import { RapidDeployAdapter } from "./RapidDeployAdapter.js";
import { ZetronAdapter } from "./ZetronAdapter.js";
import { EforceAdapter } from "./EforceAdapter.js";
import { CodyAdapter } from "./CodyAdapter.js";
import { SunridgeRimsAdapter } from "./SunridgeRimsAdapter.js";
import { KabatOneAdapter } from "./KabatOneAdapter.js";
import { OraclePsdcAdapter } from "./OraclePsdcAdapter.js";
import { GenericRestAdapter } from "./GenericRestAdapter.js";

/**
 * Registry that resolves the correct adapter class for a given vendorId.
 * Used by all Lambda handlers — never instantiate adapters directly.
 */
export class CadAdapterRegistry {
  private static adapters = new Map<string, CadAdapter>([
    ["motorola_premierone", new MotorolaPremierOneAdapter()],
    ["tyler_new_world", new TylerNewWorldAdapter()],
    ["hexagon_intergraph", new HexagonIntergraphAdapter()],
    ["central_square", new CentralSquareAdapter()],
    ["spillman", new SpillmanAdapter()],
    ["mark43", new Mark43Adapter()],
    ["caliber", new CaliberAdapter()],
    ["versaterm", new VersatermAdapter()],
    ["rapiddeploy", new RapidDeployAdapter()],
    ["zetron", new ZetronAdapter()],
    ["eforce", new EforceAdapter()],
    ["cody", new CodyAdapter()],
    ["sunridge_rims", new SunridgeRimsAdapter()],
    ["kabat_one", new KabatOneAdapter()],
    ["oracle_psdc", new OraclePsdcAdapter()],
    ["generic_rest", new GenericRestAdapter()],
  ]);

  static resolve(vendorId: string): CadAdapter {
    const adapter = this.adapters.get(vendorId);
    if (!adapter) throw new Error(`No adapter registered for vendorId: ${vendorId}`);
    return adapter;
  }
}
