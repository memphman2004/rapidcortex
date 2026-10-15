import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Sunridge RIMS uses packages/integrations CadAdapterRegistry. */
export class SunridgeRimsCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("sunridge_rims");
  }
}
