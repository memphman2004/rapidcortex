import type { CadVendor } from "rapid-cortex-shared";
import { shouldBlockDemoExternalDispatch } from "../../../demo/demo-incident-guards.js";
import { centralSquareWriteAdapter } from "./centralSquareWriteAdapter.js";
import { genericWriteAdapter } from "./genericWriteAdapter.js";
import { hexagonWriteAdapter } from "./hexagonWriteAdapter.js";
import { motorolaWriteAdapter } from "./motorolaWriteAdapter.js";
import { tylerWriteAdapter } from "./tylerWriteAdapter.js";
import { UnknownCadVendorError, type CadWriteAdapter } from "./writeTypes.js";

const adapters: Record<CadVendor, CadWriteAdapter> = {
  motorola_premier_one: motorolaWriteAdapter,
  tyler_new_world: tylerWriteAdapter,
  central_square: centralSquareWriteAdapter,
  hexagon: hexagonWriteAdapter,
  console_one: genericWriteAdapter,
  prophoenix: genericWriteAdapter,
  southern_software: genericWriteAdapter,
  generic_webhook: genericWriteAdapter,
};

function isKnownCadVendor(vendor: string): vendor is CadVendor {
  return Object.prototype.hasOwnProperty.call(adapters, vendor);
}

/**
 * Resolve a write adapter. Unknown vendors throw — never silently fall back
 * to the generic webhook adapter (misconfiguration must surface clearly).
 */
export function getCadWriteAdapter(vendor: string): CadWriteAdapter {
  if (!isKnownCadVendor(vendor)) {
    throw new UnknownCadVendorError(vendor);
  }
  const inner = adapters[vendor];
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
    read: inner.read.bind(inner),
    healthCheck: inner.healthCheck.bind(inner),
  };
}

export type { CadWriteAdapter, CadAdapterHealth, CadAdapterReadResult } from "./writeTypes.js";
export { UnknownCadVendorError } from "./writeTypes.js";
