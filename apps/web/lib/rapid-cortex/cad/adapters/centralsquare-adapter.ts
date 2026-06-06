import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/**
 * TODO(cad-centralsquare): implement CAD endpoint mappings after secure integration
 * credentials and sandbox contracts are provided by the agency/vendor.
 */
export class CentralsquareCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("centralsquare");
  }
}
