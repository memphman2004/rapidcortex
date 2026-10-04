import type { RequestTransformFunction, ResourceType } from "maplibre-gl";

type Listener = () => void;
const listeners = new Set<Listener>();

let transformRequest: RequestTransformFunction | undefined;
let authReady = !(
  typeof process !== "undefined" && Boolean(process.env?.NEXT_PUBLIC_ALS_IDENTITY_POOL_ID?.trim())
);

const V2_MAPS_URL =
  /^https:\/\/maps\.geo(?:-fips)?\.[a-z0-9-]+\.(?:amazonaws\.com|api\.aws)\/v2\//i;
const V2_DESCRIPTOR_URL = /\/v2\/styles\/[^/?]+\/descriptor(?:\?|$)/i;

/**
 * AWS Location auth-helper only SigV4-signs Maps V2 URLs when MapLibre's
 * `resourceType === "Tile"`. Descriptors/sprites/glyphs are left unsigned.
 * Style descriptors are public; tiles/glyphs/sprites are not. MapLibre 6 may
 * also omit `resourceType`. Force the helper's Tile branch for those paths.
 */
export function alsV2ResourceTypeForSigning(
  url: string,
  resourceType?: ResourceType | string,
): ResourceType | string | undefined {
  if (!V2_MAPS_URL.test(url)) return resourceType;
  if (V2_DESCRIPTOR_URL.test(url)) return resourceType ?? "Style";
  return "Tile";
}

export function wrapAlsTransformRequest(inner: RequestTransformFunction): RequestTransformFunction {
  return (url, resourceType) =>
    inner(url, alsV2ResourceTypeForSigning(url, resourceType) as ResourceType | undefined);
}

export function setMapTransformRequest(fn: RequestTransformFunction | undefined): void {
  transformRequest = fn;
}

export function getMapAuthenticationOptions(): { transformRequest?: RequestTransformFunction } {
  if (!transformRequest) return {};
  return { transformRequest: wrapAlsTransformRequest(transformRequest) };
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
