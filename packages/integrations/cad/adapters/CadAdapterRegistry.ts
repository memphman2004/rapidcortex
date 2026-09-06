import type { CadAdapter } from "../adapter/CadAdapter.js";
import { MotorolaPremierOneAdapter } from "./MotorolaPremierOneAdapter.js";
import { TylerNewWorldAdapter } from "./TylerNewWorldAdapter.js";
import { HexagonIntergraphAdapter } from "./HexagonIntergraphAdapter.js";
import { CentralSquareAdapter } from "./CentralSquareAdapter.js";
import { SpillmanAdapter } from "./SpillmanAdapter.js";
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
    ["generic_rest", new GenericRestAdapter()],
  ]);

  static resolve(vendorId: string): CadAdapter {
    const adapter = this.adapters.get(vendorId);
    if (!adapter) throw new Error(`No adapter registered for vendorId: ${vendorId}`);
    return adapter;
  }
}
