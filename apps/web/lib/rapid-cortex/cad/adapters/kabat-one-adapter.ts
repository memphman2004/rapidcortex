import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live KabatOne uses packages/integrations CadAdapterRegistry. */
export class KabatOneCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("kabat_one");
  }
}
