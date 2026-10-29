import { NEXCORT_311_SERVICE_REGISTRY } from "./seed.js";
import type { CallAssistServiceRegistryEntry } from "./types.js";

export type {
  CallAssistServiceRegistryDocument,
  CallAssistServiceRegistryEntry,
} from "./types.js";
export { NEXCORT_311_SERVICE_REGISTRY } from "./seed.js";

const byId = new Map(
  NEXCORT_311_SERVICE_REGISTRY.services.map((service) => [service.service_id, service]),
);

/** Category order is the catalog order, from police non-emergency through specialized services. */
export function listServiceRegistryCategories(): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const service of NEXCORT_311_SERVICE_REGISTRY.services) {
    if (seen.has(service.category)) continue;
    seen.add(service.category);
    categories.push(service.category);
  }
  return categories;
}

export function listServiceRegistryEntries(category?: string): readonly CallAssistServiceRegistryEntry[] {
  if (!category) return NEXCORT_311_SERVICE_REGISTRY.services;
  return NEXCORT_311_SERVICE_REGISTRY.services.filter((service) => service.category === category);
}

export function getServiceRegistryEntry(serviceId: string): CallAssistServiceRegistryEntry | undefined {
  return byId.get(serviceId);
}
