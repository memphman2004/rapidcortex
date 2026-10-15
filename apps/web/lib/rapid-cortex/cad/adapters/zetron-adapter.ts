import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Zetron uses packages/integrations CadAdapterRegistry. */
export class ZetronCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("zetron");
  }
}
