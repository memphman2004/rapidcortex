import { NotConfiguredCadAdapter } from "@/lib/rapid-cortex/cad/adapters/not-configured-adapter";

/** Pilot placeholder — live Oracle PSDC uses packages/integrations CadAdapterRegistry. */
export class OraclePsdcCadAdapter extends NotConfiguredCadAdapter {
  constructor() {
    super("oracle_psdc");
  }
}
