import { describe, expect, it } from "vitest";
import { parseTradeShowScanMedium, tradeShowQrIdFromDestParam } from "./record-site-click";

describe("record-site-click helpers", () => {
  it("defaults unspecified medium to qr so website clicks from printed QRs count as scans", () => {
    expect(parseTradeShowScanMedium(null)).toBe("qr");
    expect(parseTradeShowScanMedium("")).toBe("qr");
    expect(parseTradeShowScanMedium("QR")).toBe("qr");
    expect(parseTradeShowScanMedium("nfc")).toBe("nfc");
  });

  it("maps Home/Demo path params to reserved site qrIds", () => {
    expect(tradeShowQrIdFromDestParam("home")).toBe("site-home");
    expect(tradeShowQrIdFromDestParam("demo")).toBe("site-demo");
    expect(tradeShowQrIdFromDestParam("nope")).toBeNull();
  });
});
