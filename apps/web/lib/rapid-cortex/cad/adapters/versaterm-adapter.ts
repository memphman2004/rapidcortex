import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Versaterm uses packages/integrations CadAdapterRegistry. */
export class VersatermCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("versaterm");
  }
}
