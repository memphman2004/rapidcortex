import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/**
 * TODO(cad-motorola): map PremierOne/CommandCentral endpoints once credentials,
 * auth handshake details, and agency-approved field mapping are available.
 */
export class MotorolaCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("motorola");
  }
}
