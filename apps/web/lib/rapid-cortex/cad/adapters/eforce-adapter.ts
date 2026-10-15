import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live EFORCE uses packages/integrations CadAdapterRegistry. */
export class EforceCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("eforce");
  }
}
