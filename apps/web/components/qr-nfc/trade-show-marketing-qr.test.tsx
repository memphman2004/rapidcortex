/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRADE_SHOW_DEMO_URL, tradeShowScanUrl } from "rapid-cortex-shared";
import { TradeShowMarketingQrPanel } from "./trade-show-marketing-qr";

const HOME_SCAN = tradeShowScanUrl("home", "qr");
const DEMO_SCAN = tradeShowScanUrl("demo", "qr");

const toDataURL = vi.fn(async (url: string) => `data:image/png;base64,${btoa(url)}`);

vi.mock("qrcode", () => ({
  toDataURL,
  default: { toDataURL },
}));

describe("TradeShowMarketingQrPanel", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clickSpy.mockRestore();
    cleanup();
    toDataURL.mockClear();
  });

  it("renders Home and Demo destinations and downloads the Home PNG", async () => {
    const onDownloaded = vi.fn();
    render(<TradeShowMarketingQrPanel onDownloaded={onDownloaded} />);

    expect(screen.getByRole("heading", { name: /rapid cortex site qr/i })).toBeTruthy();
    expect(await screen.findByAltText(`QR code for ${HOME_SCAN}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(onDownloaded).toHaveBeenCalledWith("rc-trade-show-home.png");
  });

  it("encodes a tracked scan URL so website clicks are counted", async () => {
    render(<TradeShowMarketingQrPanel />);

    expect(await screen.findByAltText(`QR code for ${HOME_SCAN}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Demo" }));
    await waitFor(() => {
      expect(toDataURL).toHaveBeenCalledWith(DEMO_SCAN, expect.any(Object));
    });
    expect(await screen.findByAltText(`QR code for ${DEMO_SCAN}`)).toBeTruthy();
    expect(screen.getByText("www.rapidcortex.us/demo/")).toBeTruthy();
    expect(DEMO_SCAN).not.toBe(TRADE_SHOW_DEMO_URL);
    expect(DEMO_SCAN).toContain("/go/site/demo?medium=qr");
  });
});
