/**
 * BodyCameraProviderRegistry
 *
 * Resolves a BodyCameraProvider for a given manufacturer.
 * Adding a new manufacturer only requires registering it here —
 * the Live Assist dashboard and coaching subsystem require no changes.
 */
import type { BodyCameraManufacturer } from "rapid-cortex-shared";
import type { BodyCameraProvider } from "./BodyCameraProvider.js";
import {
  syntheticProvider,
  getacProvider,
  axonProvider,
  motorolaProvider,
  axisProvider,
  zepcamProvider,
  rtspProvider,
  webrtcProvider,
} from "./manufacturer-connectors.js";

const REGISTRY = new Map<BodyCameraManufacturer, BodyCameraProvider>([
  ["synthetic",  syntheticProvider],
  ["getac",      getacProvider],
  ["axon",       axonProvider],
  ["motorola",   motorolaProvider],
  ["axis",       axisProvider],
  ["zepcam",     zepcamProvider],
  ["rtsp",       rtspProvider],
  ["webrtc",     webrtcProvider],
]);

export function resolveProvider(manufacturer: BodyCameraManufacturer): BodyCameraProvider | null {
  return REGISTRY.get(manufacturer) ?? null;
}

export function listAllProviders(): BodyCameraProvider[] {
  return Array.from(REGISTRY.values());
}

/** Subset of providers available for the given tenant's configuration */
export function listConfiguredProviders(
  enabledManufacturers: BodyCameraManufacturer[],
): BodyCameraProvider[] {
  return enabledManufacturers
    .map((m) => REGISTRY.get(m))
    .filter((p): p is BodyCameraProvider => p !== undefined);
}
