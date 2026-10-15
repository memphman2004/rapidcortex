import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live RapidDeploy uses packages/integrations CadAdapterRegistry. */
export class RapidDeployCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("rapiddeploy");
  }
}
