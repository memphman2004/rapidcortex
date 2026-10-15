import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Mark43 uses packages/integrations CadAdapterRegistry. */
export class Mark43CadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("mark43");
  }
}
