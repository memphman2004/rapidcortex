/**
 * Booth / Rapid Cortex marketing signs open the public site — not a location report form.
 * Canonical host is www.rapidcortex.us (rapidcortex.com is a stub).
 *
 * Printed QR / NFC payloads use a tracked `/go/site/{dest}` URL on the app host so
 * every website click can be counted, then 302 to Home or Demo.
 */

export const TRADE_SHOW_HOME_URL = "https://www.rapidcortex.us";
export const TRADE_SHOW_DEMO_URL = "https://www.rapidcortex.us/demo/";

export const TRADE_SHOW_SITE_AGENCY_ID = "rapid-cortex-platform";
export const TRADE_SHOW_SITE_QR_IDS = {
  home: "site-home",
  demo: "site-demo",
} as const;

export const TRADE_SHOW_DESTINATIONS = [
  { id: "home", url: TRADE_SHOW_HOME_URL, label: "Home" },
  { id: "demo", url: TRADE_SHOW_DEMO_URL, label: "Demo" },
] as const;

export type TradeShowDestinationId = (typeof TRADE_SHOW_DESTINATIONS)[number]["id"];
export type TradeShowSiteQrId = (typeof TRADE_SHOW_SITE_QR_IDS)[TradeShowDestinationId];
export type TradeShowScanMedium = "qr" | "nfc";

const GO_SITE_PATH = /^\/go\/site\/(home|demo)\/?$/i;

export function tradeShowUrlFor(id: TradeShowDestinationId): string {
  const row = TRADE_SHOW_DESTINATIONS.find((d) => d.id === id);
  return row?.url ?? TRADE_SHOW_HOME_URL;
}

export function tradeShowQrIdFor(id: TradeShowDestinationId): TradeShowSiteQrId {
  return TRADE_SHOW_SITE_QR_IDS[id];
}

export function parseTradeShowDestination(raw: string | undefined | null): TradeShowDestinationId | null {
  const token = (raw ?? "").trim().toLowerCase();
  if (token === "home" || token === "demo") return token;
  return null;
}

export function tradeShowDestFromQrId(qrId: string): TradeShowDestinationId | null {
  const token = qrId.trim().toLowerCase();
  if (token === TRADE_SHOW_SITE_QR_IDS.home) return "home";
  if (token === TRADE_SHOW_SITE_QR_IDS.demo) return "demo";
  return null;
}

export function isTradeShowSiteQrId(qrId: string | undefined | null): boolean {
  return tradeShowDestFromQrId(qrId ?? "") !== null;
}

export function isMarketingSiteQrRecord(row: {
  qrId?: string;
  agencyId?: string;
  kind?: string;
}): boolean {
  if (row.kind === "marketing_site") return true;
  if ((row.agencyId ?? "").trim() === TRADE_SHOW_SITE_AGENCY_ID) return true;
  return isTradeShowSiteQrId(row.qrId);
}

/** App origin used in tracked scan URLs (QR PNG + NFC write). */
export function tradeShowAppOrigin(): string {
  const env =
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ||
        process.env.EXPO_PUBLIC_APP_ORIGIN?.trim() ||
        process.env.APP_BASE_URL?.trim()
      : "") || "";
  if (env) return env.replace(/\/$/, "");
  return "https://app.rapidcortex.us";
}

export function tradeShowGoPath(id: TradeShowDestinationId, medium: TradeShowScanMedium = "qr"): string {
  return `/go/site/${id}?medium=${medium}`;
}

/** URL encoded in the site QR / written to the booth NFC tag. */
export function tradeShowScanUrl(
  id: TradeShowDestinationId,
  medium: TradeShowScanMedium = "qr",
): string {
  return `${tradeShowAppOrigin()}${tradeShowGoPath(id, medium)}`;
}

export function parseTradeShowGoPathname(pathname: string): TradeShowDestinationId | null {
  const match = GO_SITE_PATH.exec(pathname.trim());
  if (!match?.[1]) return null;
  return parseTradeShowDestination(match[1]);
}

export function isTradeShowMarketingUrl(url: string): boolean {
  const trimmed = url.trim();
  if (TRADE_SHOW_DESTINATIONS.some((d) => d.url === trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parseTradeShowGoPathname(parsed.pathname) !== null;
  } catch {
    return false;
  }
}

export function tradeShowQrFileName(id: TradeShowDestinationId): string {
  return id === "demo" ? "rc-trade-show-demo.png" : "rc-trade-show-home.png";
}

export function tradeShowSiteDisplayName(id: TradeShowDestinationId): string {
  return id === "demo" ? "Rapid Cortex site — Demo" : "Rapid Cortex site — Home";
}
