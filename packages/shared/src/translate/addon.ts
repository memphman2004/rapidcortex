import type { TranslateVertical } from "./types.js";
import { TRANSLATE_ADDON_BY_VERTICAL } from "./types.js";

const LIVE_TRANSLATION_PREFIX = "translation.live.";

/**
 * Exact addon key for a vertical. Law enforcement also accepts legacy
 * `translation.live.*` SKUs. Do **not** prefix-match `rc.translate` or venue
 * agencies would inherit the LE SKU (and vice versa).
 */
export function translateAddonKey(vertical: TranslateVertical): string {
  return TRANSLATE_ADDON_BY_VERTICAL[vertical];
}

export function matchesTranslateAddon(
  enabledAddons: readonly string[],
  vertical: TranslateVertical,
): boolean {
  const listed = enabledAddons.map((k) => k.trim()).filter(Boolean);
  const exact = translateAddonKey(vertical);
  if (listed.includes(exact)) return true;
  if (vertical === "law_enforcement") {
    return listed.some((k) => k === "rc.translate" || k.startsWith(LIVE_TRANSLATION_PREFIX));
  }
  return false;
}
