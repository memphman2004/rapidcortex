/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRADE_SHOW_DEMO_URL, tradeShowScanUrl } from "rapid-cortex-shared";
import { TradeShowMarketingQrPanel } from "./trade-show-marketing-qr";

const HOME_SCAN = tradeShowScanUrl("home", "qr");
const DEMO_SCAN = tradeShowScanUrl("demo", "qr");

const toCanvas = vi.fn(async (canvas: HTMLCanvasElement, _url: string) => {
  canvas.width = 512;
  canvas.height = 512;
  return canvas;
});

vi.mock("qrcode", () => ({
  toCanvas,
  default: { toCanvas },
}));

describe("TradeShowMarketingQrPanel", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    // jsdom canvas stub — enough for logo overlay path.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => `data:image/png;base64,${btoa("qr")}`,
    ) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
    // Logo load fails in tests → QR still renders without mark.
    vi.spyOn(globalThis, "Image").mockImplementation(function MockImage(this: HTMLImageElement) {
      setTimeout(() => {
        this.onerror?.(new Event("error") as unknown as string & Event);
      }, 0);
      return this;
    } as unknown as typeof Image);
  });

  afterEach(() => {
    clickSpy.mockRestore();
    cleanup();
    toCanvas.mockClear();
    vi.restoreAllMocks();
  });

  it("renders Home and Demo destinations and downloads the Home PNG", async () => {
    const onDownloaded = vi.fn();
    render(<TradeShowMarketingQrPanel onDownloaded={onDownloaded} />);

    expect(screen.getByRole("heading", { name: /nexcort iq site qr|rapid cortex site qr/i })).toBeTruthy();
    expect(await screen.findByAltText(`QR code for ${HOME_SCAN}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(onDownloaded).toHaveBeenCalledWith("rc-trade-show-home.png");
  });

  it("encodes a tracked scan URL so website clicks are counted", async () => {
    render(<TradeShowMarketingQrPanel />);

    expect(await screen.findByAltText(`QR code for ${HOME_SCAN}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Demo" }));
    await waitFor(() => {
      expect(toCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), DEMO_SCAN, expect.any(Object));
    });
    expect(await screen.findByAltText(`QR code for ${DEMO_SCAN}`)).toBeTruthy();
    expect(screen.getByText("www.nexcortiq.us/demo/")).toBeTruthy();
    expect(DEMO_SCAN).not.toBe(TRADE_SHOW_DEMO_URL);
    expect(DEMO_SCAN).toContain("/go/site/demo?medium=qr");
  });
});
