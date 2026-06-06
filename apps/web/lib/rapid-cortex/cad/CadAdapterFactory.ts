import type { CadAdapter } from "@/lib/rapid-cortex/cad/CadAdapter";
import { BridgedCadReadAdapter } from "@/lib/rapid-cortex/cad/bridged-cad-read-adapter";
import { DisabledCadAdapter } from "@/lib/rapid-cortex/cad/DisabledCadAdapter";
import { DisabledCadReadAdapter } from "@/lib/rapid-cortex/cad/disabled-cad-read-adapter";
import type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
import { MotorolaCadReadAdapter } from "@/lib/rapid-cortex/cad/motorola-cad-read-adapter";
import { StagingCadReadAdapter } from "@/lib/rapid-cortex/cad/staging-cad-read-adapter";

/**
 * Central place to resolve which CAD adapter to use. Defaults to disabled (no live CAD).
 * CAD credentials must never be exposed to the browser; only server routes use this.
 */
export function resolveCadReadProvider(): CadReadProvider {
  const mode = (process.env.CAD_INTEGRATION_MODE ?? "disabled").trim().toLowerCase();
  if (mode !== "read_only") {
    return new DisabledCadReadAdapter();
  }
  const vendor = (process.env.CAD_VENDOR_NAME ?? "").trim().toLowerCase();
  if (vendor.includes("motorola")) {
    return new MotorolaCadReadAdapter();
  }
  return new StagingCadReadAdapter();
}

/** Legacy shim for routes using `CadAdapter` typings (writes always fail — see HTTP CAD write gate). */
export function resolveCadAdapter(): CadAdapter {
  const mode = (process.env.CAD_INTEGRATION_MODE ?? "disabled").trim().toLowerCase();
  if (mode === "read_only") {
    return new BridgedCadReadAdapter(resolveCadReadProvider());
  }
  return new DisabledCadAdapter();
}
