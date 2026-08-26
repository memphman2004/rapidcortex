import { describe, expect, it } from "vitest";
import {
  isMarketingSiteQrRecord,
  isTradeShowMarketingUrl,
  isTradeShowSiteQrId,
  parseTradeShowDestination,
  parseTradeShowGoPathname,
  TRADE_SHOW_DEMO_URL,
  TRADE_SHOW_DESTINATIONS,
  TRADE_SHOW_HOME_URL,
  TRADE_SHOW_SITE_AGENCY_ID,
  TRADE_SHOW_SITE_QR_IDS,
  tradeShowQrFileName,
  tradeShowQrIdFor,
  tradeShowScanUrl,
  tradeShowUrlFor,
} from "./trade-show.js";

describe("trade-show marketing URLs", () => {
  it("allowlists home and demo destinations", () => {
    expect(TRADE_SHOW_HOME_URL).toBe("https://www.rapidcortex.us");
    expect(TRADE_SHOW_DEMO_URL).toBe("https://www.rapidcortex.us/demo/");
    expect(TRADE_SHOW_DESTINATIONS.map((d) => d.id)).toEqual(["home", "demo"]);
    expect(isTradeShowMarketingUrl(TRADE_SHOW_HOME_URL)).toBe(true);
    expect(isTradeShowMarketingUrl(TRADE_SHOW_DEMO_URL)).toBe(true);
    expect(tradeShowUrlFor("home")).toBe(TRADE_SHOW_HOME_URL);
    expect(tradeShowUrlFor("demo")).toBe(TRADE_SHOW_DEMO_URL);
    expect(tradeShowQrFileName("home")).toBe("rc-trade-show-home.png");
    expect(tradeShowQrFileName("demo")).toBe("rc-trade-show-demo.png");
  });

  it("accepts tracked /go/site scan URLs used on QR and NFC", () => {
    expect(parseTradeShowDestination("HOME")).toBe("home");
    expect(parseTradeShowGoPathname("/go/site/demo")).toBe("demo");
    expect(parseTradeShowGoPathname("/go/site/home/")).toBe("home");
    expect(tradeShowQrIdFor("home")).toBe(TRADE_SHOW_SITE_QR_IDS.home);
    expect(isTradeShowSiteQrId("site-demo")).toBe(true);
    expect(isTradeShowMarketingUrl("https://app.rapidcortex.us/go/site/home?medium=qr")).toBe(true);
    expect(isTradeShowMarketingUrl("https://app.rapidcortex.us/go/site/demo?medium=nfc")).toBe(true);
    expect(tradeShowScanUrl("home", "qr")).toContain("/go/site/home?medium=qr");
    expect(tradeShowScanUrl("demo", "nfc")).toContain("/go/site/demo?medium=nfc");
  });

  it("rejects report URLs and the .com stub", () => {
    expect(isTradeShowMarketingUrl("https://app.rapidcortex.us/report/ABC")).toBe(false);
    expect(isTradeShowMarketingUrl("https://rapidcortex.com")).toBe(false);
    expect(isTradeShowMarketingUrl("https://www.rapidcortex.com")).toBe(false);
    expect(isTradeShowMarketingUrl("https://www.rapidcortex.us/demo")).toBe(false);
    expect(isMarketingSiteQrRecord({ agencyId: TRADE_SHOW_SITE_AGENCY_ID, qrId: "x" })).toBe(true);
    expect(isMarketingSiteQrRecord({ qrId: "site-home" })).toBe(true);
    expect(isMarketingSiteQrRecord({ qrId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", agencyId: "campus-csu" })).toBe(
      false,
    );
  });
});
