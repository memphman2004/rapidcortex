const CARD_HOST = 'www.nexcortiq.us';

/** Permanent business-card NFC URL: https://www.nexcortiq.us/c/{cardId} */
export function isBusinessCardNfcUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== CARD_HOST) return false;
    const parts = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return parts.length === 2 && parts[0] === 'c' && parts[1].length > 0;
  } catch {
    return false;
  }
}

export function shortCardId(cardId: string): string {
  return cardId.slice(0, 8);
}
