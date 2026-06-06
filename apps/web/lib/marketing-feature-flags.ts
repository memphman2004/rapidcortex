/**
 * Build-time NEXT_PUBLIC_* toggles for marketing chrome (header/footer links).
 */

function truthyPublicFlag(raw: string | undefined, defaultTrue: boolean): boolean {
  const v = raw?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultTrue;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return defaultTrue;
}

export function isDownloadsMarketingEnabled(): boolean {
  return truthyPublicFlag(process.env.NEXT_PUBLIC_ENABLE_DOWNLOADS, true);
}

export function isRcLiteMarketingEnabled(): boolean {
  return truthyPublicFlag(process.env.NEXT_PUBLIC_ENABLE_RC_LITE, true);
}
