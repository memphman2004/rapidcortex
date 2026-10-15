import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Caliber uses packages/integrations CadAdapterRegistry. */
export class CaliberCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("caliber");
  }
}
