import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Spillman Flex uses packages/integrations CadAdapterRegistry. */
export class SpillmanCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("spillman");
  }
}
