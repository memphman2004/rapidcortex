import type { CadProviderId } from "rapid-cortex-shared";
import type { CADProvider } from "./provider.js";
import { MockCadAdapter } from "./mock-adapter.js";
import { MotorolaPremierOneAdapter } from "./motorola-premierone-adapter.js";

export function resolveCadProvider(
  providerId: CadProviderId | undefined,
  natureMapping: Record<string, string> = {},
): CADProvider {
  if (providerId === "motorola-premierone") {
    return new MotorolaPremierOneAdapter(natureMapping);
  }
  return new MockCadAdapter();
}
