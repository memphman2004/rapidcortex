import * as maplibregl from "maplibre-gl";

let workerConfigured = false;

/**
 * MapLibre 6's ESM worker and shared chunk must load same-origin.
 * Next/webpack otherwise builds a broken blob worker URL and tiles never paint
 * (controls and attribution still show).
 */
export function ensureMapLibreWorker(): void {
  if (workerConfigured || typeof window === "undefined") return;
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
  workerConfigured = true;
}
