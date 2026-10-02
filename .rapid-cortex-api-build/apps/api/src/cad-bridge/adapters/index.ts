import type { CADVendor } from "rapid-cortex-shared";
import type { CADAdapter } from "./base.js";
import { MotorolaPremierOneBridgeAdapter } from "./motorola.js";
import { RestVendorBridgeAdapter } from "./rest-vendors.js";
import { TylerNewWorldBridgeAdapter } from "./tyler.js";

const REST_VENDORS = [
  "CENTRALSQUARE",
  "HEXAGON",
  "SPILLMAN",
  "AXON",
  "HARRIS",
  "VERSATERM",
  "MARK43",
  "ORACLE",
  "SOUTHERN_SOFTWARE",
] as const;

const registry = new Map<CADVendor, CADAdapter>([
  ["MOTOROLA", new MotorolaPremierOneBridgeAdapter()],
  ["TYLER", new TylerNewWorldBridgeAdapter()],
  ...REST_VENDORS.map((vendor) => [vendor, new RestVendorBridgeAdapter(vendor)] as const),
]);

export function getCadBridgeAdapter(vendor: CADVendor): CADAdapter {
  const adapter = registry.get(vendor);
  if (!adapter) {
    throw new Error(`No CAD bridge adapter registered for vendor: ${vendor}`);
  }
  return adapter;
}

export function isSupportedCadBridgeVendor(vendor: string): vendor is CADVendor {
  return registry.has(vendor as CADVendor);
}

export { AdapterParseError } from "./base.js";
export type { CADAdapter } from "./base.js";
