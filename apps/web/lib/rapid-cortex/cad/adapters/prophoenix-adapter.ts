import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Browser placeholder. Live ProPhoenix polling uses the server CAD poll adapter. */
export class ProPhoenixCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("prophoenix");
  }
}
