import type { RequestTransformFunction } from "maplibre-gl";

type Listener = () => void;
const listeners = new Set<Listener>();

let transformRequest: RequestTransformFunction | undefined;
let authReady = !(
  typeof process !== "undefined" && Boolean(process.env?.NEXT_PUBLIC_ALS_IDENTITY_POOL_ID?.trim())
);

export function setMapTransformRequest(fn: RequestTransformFunction | undefined): void {
  transformRequest = fn;
}

export function getMapAuthenticationOptions(): { transformRequest?: RequestTransformFunction } {
  return transformRequest ? { transformRequest } : {};
}

export function markMapAuthReady(): void {
  authReady = true;
  for (const listener of listeners) listener();
}

export function isMapAuthReady(): boolean {
  return authReady;
}

export function subscribeMapAuthReady(listener: Listener): () => void {
  listeners.add(listener);
  if (authReady) listener();
  return () => {
    listeners.delete(listener);
  };
}
