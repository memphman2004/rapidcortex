import type { CadVendor } from "rapid-cortex-shared";
import { shouldBlockDemoExternalDispatch } from "../../../demo/demo-incident-guards.js";
import { centralSquareWriteAdapter } from "./centralSquareWriteAdapter.js";
import { genericWriteAdapter } from "./genericWriteAdapter.js";
import { hexagonWriteAdapter } from "./hexagonWriteAdapter.js";
import { motorolaWriteAdapter } from "./motorolaWriteAdapter.js";
import { tylerWriteAdapter } from "./tylerWriteAdapter.js";
import type { CadWriteAdapter } from "./writeTypes.js";

const adapters: Record<CadVendor, CadWriteAdapter> = {
  motorola_premier_one: motorolaWriteAdapter,
  tyler_new_world: tylerWriteAdapter,
  central_square: centralSquareWriteAdapter,
  hexagon: hexagonWriteAdapter,
  console_one: genericWriteAdapter,
  generic_webhook: genericWriteAdapter,
};

export function getCadWriteAdapter(vendor: string): CadWriteAdapter {
  const inner = adapters[vendor as CadVendor] ?? genericWriteAdapter;
  return {
    vendor: inner.vendor,
    async submit(params) {
      if (shouldBlockDemoExternalDispatch(params.incident)) {
        console.warn(
          "[CAD ADAPTER] Hard-blocked: isDemoIncident=true on record",
          params.incident.incidentId,
        );
        return { success: true, cadResponse: "demo-blocked" };
      }
      return inner.submit(params);
    },
  };
}

export type { CadWriteAdapter } from "./writeTypes.js";
