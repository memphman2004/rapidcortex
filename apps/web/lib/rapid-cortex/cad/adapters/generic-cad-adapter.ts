import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/**
 * TODO(cad-generic): implement agency-specific custom mapping once custom CAD
 * integration specs are documented and approved.
 */
export class GenericCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("generic");
  }
}
