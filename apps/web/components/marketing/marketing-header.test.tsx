/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-context";
import { MarketingHeader, getMarketingMobileDrawerLinkDefs, isOperationalAuthHref } from "./marketing-header";

function MarketingHeaderHarness() {
  return (
    <SessionProvider>
      <MarketingHeader />
    </SessionProvider>
  );
}

function mockViewport(isDesktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop ? /\(min-width:\s*768px\)/.test(query) || query === "" : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("marketing mobile drawer link definitions", () => {
  it("lists public destinations without operational auth URLs", () => {
    const links = [...getMarketingMobileDrawerLinkDefs()];
    const hrefs = links.map((l) => l.href);
    expect(links.some((l) => l.label === "Home")).toBe(true);
    expect(links.some((l) => l.label === "Features")).toBe(true);
    expect(links.some((l) => l.label === "Pricing")).toBe(true);
    expect(links.some((l) => l.label === "Demo")).toBe(true);
    expect(links.some((l) => l.label === "Contact")).toBe(true);
    expect(hrefs).not.toContain("/login");
    expect(hrefs).not.toContain("/signup");
    for (const href of hrefs) {
      expect(isOperationalAuthHref(href)).toBe(false);
    }
  });

  it("does not expose technical marketing routes reserved for desktop", () => {
    const links = getMarketingMobileDrawerLinkDefs();
    const labels = links.map((l) => l.label);
    expect(labels).not.toContain("RC Lite");
    expect(labels).not.toContain("Downloads");
    expect(labels).not.toContain("Desktop");
    expect(labels).not.toContain("Book Demo");
    expect(labels).not.toContain("Developers");
  });
});

describe("isOperationalAuthHref", () => {
  it("flags auth and workspace paths", () => {
    expect(isOperationalAuthHref("/login")).toBe(true);
    expect(isOperationalAuthHref("/auth/callback")).toBe(true);
    expect(isOperationalAuthHref("/agency-x/dashboard")).toBe(true);
    expect(isOperationalAuthHref("/agency-x/login")).toBe(true);
    expect(isOperationalAuthHref("/pricing")).toBe(false);
    expect(isOperationalAuthHref("/")).toBe(false);
  });
});

describe("MarketingHeader", () => {
  beforeEach(() => {
    mockViewport(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: null }),
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.removeAttribute("style");
  });

  it("renders compact navigation opener on narrow viewport mock", async () => {
    render(<MarketingHeaderHarness />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Open navigation menu$/ })).toBeTruthy();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens drawer, lists marketing links and Book appointment", async () => {
    render(<MarketingHeaderHarness />);

    const openBtn = screen.getByRole("button", { name: /^Open navigation menu$/ });
    fireEvent.click(openBtn);

    const dialog = await screen.findByRole("dialog");
    const book = within(dialog).getByRole("link", { name: /^Request a demo$/ });
    expect(book.getAttribute("href")).toBe("/contact-sales?interest=demo");
    expect(within(dialog).queryByRole("link", { name: /^Sign in$/ })).toBeNull();
    expect(within(dialog).getByRole("link", { name: /^Open app$/ }).getAttribute("href")).toBe("/login");

    expect(within(dialog).getByRole("link", { name: /^Home$/ }).getAttribute("href")).toBe("/");
    expect(within(dialog).getByRole("link", { name: /^Features$/ }).getAttribute("href")).toBe("/solutions/agencies");
    expect(within(dialog).getByRole("link", { name: /^Pricing$/ }).getAttribute("href")).toBe("/pricing");
    expect(within(dialog).getByRole("link", { name: /^Demo$/ }).getAttribute("href")).toBe("/demo");
    expect(within(dialog).getByRole("link", { name: /^Contact$/ }).getAttribute("href")).toBe("/contact");

    /** Close via Escape restores focus target */
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("includes brand slogan text in drawer", async () => {
    render(<MarketingHeaderHarness />);
    fireEvent.click(screen.getByRole("button", { name: /^Open navigation menu$/ }));

    expect(await screen.findByText(/Intelligence at the speed of response/i)).toBeTruthy();
    expect(screen.getByText(/demo request form/i)).toBeTruthy();
  });
});
