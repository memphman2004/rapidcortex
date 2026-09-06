import { describe, expect, it } from "vitest";
import { MotorolaPremierOneAdapter } from "../adapters/MotorolaPremierOneAdapter.js";
import { TylerNewWorldAdapter } from "../adapters/TylerNewWorldAdapter.js";
import { HexagonIntergraphAdapter } from "../adapters/HexagonIntergraphAdapter.js";
import { CentralSquareAdapter } from "../adapters/CentralSquareAdapter.js";
import { SpillmanAdapter } from "../adapters/SpillmanAdapter.js";
import { GenericRestAdapter } from "../adapters/GenericRestAdapter.js";
import { CadAdapterRegistry } from "../adapters/CadAdapterRegistry.js";
import { TylerNewWorldAdapter } from "../adapters/TylerNewWorldAdapter.js";
import { HexagonIntergraphAdapter } from "../adapters/HexagonIntergraphAdapter.js";
import { CentralSquareAdapter } from "../adapters/CentralSquareAdapter.js";
import { SpillmanAdapter } from "../adapters/SpillmanAdapter.js";
import { GenericRestAdapter } from "../adapters/GenericRestAdapter.js";
import { CadAdapterRegistry } from "../adapters/CadAdapterRegistry.js";

describe("CadAdapterRegistry", () => {
  it("resolves every supported vendor", () => {
    expect(CadAdapterRegistry.resolve("motorola_premierone")).toBeInstanceOf(MotorolaPremierOneAdapter);
    expect(CadAdapterRegistry.resolve("tyler_new_world")).toBeInstanceOf(TylerNewWorldAdapter);
    expect(CadAdapterRegistry.resolve("hexagon_intergraph")).toBeInstanceOf(HexagonIntergraphAdapter);
    expect(CadAdapterRegistry.resolve("central_square")).toBeInstanceOf(CentralSquareAdapter);
    expect(CadAdapterRegistry.resolve("spillman")).toBeInstanceOf(SpillmanAdapter);
    expect(CadAdapterRegistry.resolve("generic_rest")).toBeInstanceOf(GenericRestAdapter);
  });

  it("throws for an unknown vendor id", () => {
    expect(() => CadAdapterRegistry.resolve("not_a_vendor")).toThrow(/No adapter registered/);
  });
});
