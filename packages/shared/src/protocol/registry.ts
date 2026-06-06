import { DEFAULT_PROTOCOL_PACKS } from "./defaultPacks.js";
import type { ProtocolPack } from "./types.js";

/** Immutable registry of built-in protocol packs (agency overlays replace this list later). */
export function listProtocolPacks(): readonly ProtocolPack[] {
  return DEFAULT_PROTOCOL_PACKS;
}

export function getProtocolPackById(id: string): ProtocolPack | null {
  return DEFAULT_PROTOCOL_PACKS.find((p) => p.id === id) ?? null;
}
