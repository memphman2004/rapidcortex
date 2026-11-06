import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Browser placeholder. Live Southern Software polling uses the server CAD poll adapter. */
export class SouthernSoftwareCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("southern_software");
  }
}
