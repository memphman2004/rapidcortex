import type { CadProviderId } from "rapid-cortex-shared";
import type { CADProvider } from "./provider.js";
import { MockCadAdapter } from "./mock-adapter.js";
import { RestVendorCadAdapter } from "./rest-vendor-adapter.js";

const LIVE_VENDORS: Exclude<CadProviderId, "mock">[] = [
  "motorola-premierone",
  "tyler-new-world",
  "hexagon-intergraph",
  "centralsquare",
  "zetron",
  "mark43",
  "versaterm",
];

export function resolveCadProvider(
  providerId: CadProviderId | undefined,
  natureMapping: Record<string, string> = {},
): CADProvider {
  if (providerId && LIVE_VENDORS.includes(providerId as Exclude<CadProviderId, "mock">)) {
    return new RestVendorCadAdapter(providerId as Exclude<CadProviderId, "mock">, natureMapping);
  }
  return new MockCadAdapter();
}
