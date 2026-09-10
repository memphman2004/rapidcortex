import { DemoVisionProvider } from "./DemoVisionProvider.js";
import type { CameraProvider } from "./CameraProvider.js";
import type { VisionProvider } from "rapid-cortex-shared";

const demo = new DemoVisionProvider();

/**
 * Runtime lookup for Rapid Vision™ camera sources.
 * Ring and caller-video adapters are constructed when their repositories are injected.
 */
export function getVisionProvider(provider: VisionProvider): CameraProvider | null {
  if (provider === "demo") return demo;
  return null;
}

export { DemoVisionProvider } from "./DemoVisionProvider.js";
export { RingVisionProvider } from "./RingVisionProvider.js";
export { CallerVideoProvider } from "./CallerVideoProvider.js";
export type { CameraProvider } from "./CameraProvider.js";
