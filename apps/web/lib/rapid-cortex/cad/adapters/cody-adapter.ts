import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live CODY uses packages/integrations CadAdapterRegistry. */
export class CodyCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("cody");
  }
}
