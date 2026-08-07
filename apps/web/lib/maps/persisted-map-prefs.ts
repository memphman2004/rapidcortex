/**
 * Per-user OPERATIONAL MAP prefs (layers + map theme).
 * Survives logout/login on the same browser; scoped by Cognito user id + vertical.
 */

import {
  DEFAULT_LAYER_VISIBILITY,
  type RCMapLayerVisibility,
} from "@/components/maps/map-types";
import { readLocalStorage, writeLocalStorage } from "@/lib/account/account-picture";

export type PersistedMapTheme = "dark" | "light";

export function mapLayersStorageKey(userId: string, vertical: string): string {
  return `rc-map-layers:user:${userId}:${vertical}`;
}

export function mapThemeStorageKey(userId: string, vertical: string): string {
  return `rc-map-theme:user:${userId}:${vertical}`;
}

function isLayerKey(k: string): k is keyof RCMapLayerVisibility {
  return k in DEFAULT_LAYER_VISIBILITY;
}

export function loadMapLayers(
  userId: string | undefined | null,
  vertical: string,
  defaults?: Partial<RCMapLayerVisibility>,
): RCMapLayerVisibility {
  const base: RCMapLayerVisibility = { ...DEFAULT_LAYER_VISIBILITY, ...defaults };
  if (!userId || typeof window === "undefined") return base;
  const raw = readLocalStorage(mapLayersStorageKey(userId, vertical));
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...base };
    for (const [k, v] of Object.entries(parsed)) {
      if (isLayerKey(k) && typeof v === "boolean") next[k] = v;
    }
    return next;
  } catch {
    return base;
  }
}

export function saveMapLayers(
  userId: string | undefined | null,
  vertical: string,
  layers: RCMapLayerVisibility,
): void {
  if (!userId) return;
  writeLocalStorage(mapLayersStorageKey(userId, vertical), JSON.stringify(layers));
}

export function loadMapTheme(
  userId: string | undefined | null,
  vertical: string,
  fallback: PersistedMapTheme = "dark",
): PersistedMapTheme {
  if (!userId || typeof window === "undefined") return fallback;
  const raw = readLocalStorage(mapThemeStorageKey(userId, vertical));
  return raw === "light" || raw === "dark" ? raw : fallback;
}

export function saveMapTheme(
  userId: string | undefined | null,
  vertical: string,
  theme: PersistedMapTheme,
): void {
  if (!userId) return;
  writeLocalStorage(mapThemeStorageKey(userId, vertical), theme);
}
