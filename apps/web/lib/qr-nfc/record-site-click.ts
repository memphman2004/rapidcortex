import {
  parseTradeShowDestination,
  tradeShowQrIdFor,
  type TradeShowDestinationId,
  type TradeShowScanMedium,
} from "rapid-cortex-shared";

export function parseTradeShowScanMedium(raw: string | null): TradeShowScanMedium {
  return raw?.trim().toLowerCase() === "nfc" ? "nfc" : "qr";
}

export function tradeShowQrIdFromDestParam(raw: string): string | null {
  const dest = parseTradeShowDestination(raw);
  if (!dest) return null;
  return tradeShowQrIdFor(dest);
}

export async function recordTradeShowSiteClick(
  origin: string,
  dest: TradeShowDestinationId,
  medium: TradeShowScanMedium,
): Promise<void> {
  const qrId = tradeShowQrIdFor(dest);
  const base = origin.replace(/\/$/, "");
  await fetch(`${base}/api/qr-nfc/${encodeURIComponent(qrId)}/engage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ medium }),
    cache: "no-store",
  });
}
