import { describe, expect, it, vi } from "vitest";
import { TRADE_SHOW_HOME_URL } from "rapid-cortex-shared";

vi.mock("@/lib/qr-nfc/record-site-click", () => ({
  parseTradeShowScanMedium: (raw: string | null) => (raw === "nfc" ? "nfc" : "qr"),
  recordTradeShowSiteClick: vi.fn(async () => undefined),
}));

import { GET } from "../../app/go/site/[dest]/route";
import { recordTradeShowSiteClick } from "@/lib/qr-nfc/record-site-click";

describe("GET /go/site/[dest]", () => {
  it("records a QR click and redirects to the marketing home page", async () => {
    const res = await GET(new Request("https://app.rapidcortex.us/go/site/home?medium=qr"), {
      params: Promise.resolve({ dest: "home" }),
    });
    expect(recordTradeShowSiteClick).toHaveBeenCalledWith("https://app.rapidcortex.us", "home", "qr");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")?.replace(/\/$/, "")).toBe(TRADE_SHOW_HOME_URL);
  });

  it("treats a missing medium as a QR website click", async () => {
    await GET(new Request("https://app.rapidcortex.us/go/site/demo"), {
      params: Promise.resolve({ dest: "demo" }),
    });
    expect(recordTradeShowSiteClick).toHaveBeenCalledWith("https://app.rapidcortex.us", "demo", "qr");
  });
});
