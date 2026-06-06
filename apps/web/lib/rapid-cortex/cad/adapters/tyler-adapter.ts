import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/**
 * TODO(cad-tyler): implement Tyler CAD API bridge once API docs and approved
 * security credentials are supplied for each tenant agency.
 */
export class TylerCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("tyler");
  }
}
