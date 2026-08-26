import { describe, expect, it } from "vitest";
import {
  isTradeShowMarketingUrl,
  TRADE_SHOW_DEMO_URL,
  TRADE_SHOW_DESTINATIONS,
  TRADE_SHOW_HOME_URL,
  tradeShowQrFileName,
  tradeShowScanUrl,
  tradeShowUrlFor,
} from "./trade-show-nfc";

describe("trade-show marketing URLs", () => {
  it("allowlists home and demo only", () => {
    expect(TRADE_SHOW_HOME_URL).toBe("https://www.rapidcortex.us");
    expect(TRADE_SHOW_DEMO_URL).toBe("https://www.rapidcortex.us/demo/");
    expect(TRADE_SHOW_DESTINATIONS.map((d) => d.id)).toEqual(["home", "demo"]);
    expect(isTradeShowMarketingUrl(TRADE_SHOW_HOME_URL)).toBe(true);
    expect(isTradeShowMarketingUrl(TRADE_SHOW_DEMO_URL)).toBe(true);
    expect(tradeShowUrlFor("home")).toBe(TRADE_SHOW_HOME_URL);
    expect(tradeShowUrlFor("demo")).toBe(TRADE_SHOW_DEMO_URL);
    expect(tradeShowQrFileName("demo")).toBe("rc-trade-show-demo.png");
  });

  it("accepts tracked scan URLs written to NFC tags", () => {
    const nfcHome = tradeShowScanUrl("home", "nfc");
    expect(nfcHome).toContain("/go/site/home?medium=nfc");
    expect(isTradeShowMarketingUrl(nfcHome)).toBe(true);
  });

  it("rejects report URLs and the .com stub", () => {
    expect(isTradeShowMarketingUrl("https://app.rapidcortex.us/report/ABC")).toBe(false);
    expect(isTradeShowMarketingUrl("https://rapidcortex.com")).toBe(false);
    expect(isTradeShowMarketingUrl("https://www.rapidcortex.com")).toBe(false);
    expect(isTradeShowMarketingUrl("https://www.rapidcortex.us/demo")).toBe(false);
  });
});
