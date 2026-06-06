/**
 * Versioned catalog surface for agency protocol packs.
 * Pack definitions currently ship from `rapid-cortex-shared`; this package is the
 * integration point for future JSON-only packs and per-agency overlays.
 */
import {
  DEFAULT_PROTOCOL_PACKS,
  getProtocolPackById,
  listProtocolPacks,
} from "rapid-cortex-shared";

export const PROTOCOL_CATALOG_VERSION = "1.0.0";

export { DEFAULT_PROTOCOL_PACKS, getProtocolPackById, listProtocolPacks };

export function listDefaultPackIds(): string[] {
  return DEFAULT_PROTOCOL_PACKS.map((p) => p.id);
}
