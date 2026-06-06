import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/**
 * TODO(cad-hexagon): wire Hexagon/Intergraph integration once endpoint contracts
 * and security credentials are approved and available.
 */
export class HexagonCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("hexagon");
  }
}
