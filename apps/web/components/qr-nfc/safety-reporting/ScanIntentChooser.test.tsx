/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScanIntentChooser } from "./ScanIntentChooser";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === "string" ? src : ""} />
  ),
}));

describe("ScanIntentChooser", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("routes Information to Guest Assist and Police/Security to the report form", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/report/01abc",
      search: "?medium=nfc",
      assign,
    });
    const onPoliceSecurity = vi.fn();
    render(
      <ScanIntentChooser
        productLabel="Rapid Cortex Transit"
        contextLabel="Transit Safety Reporting"
        agencyName="MARTA"
        zoneName="Five Points"
        vertical="transit"
        agencyId="marta"
        guestAssistEnabled
        onPoliceSecurity={onPoliceSecurity}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /information/i }));
    expect(assign).toHaveBeenCalled();
    const dest = String(assign.mock.calls[0]?.[0] ?? "");
    expect(dest).toContain("/rc-guest-assist.html");
    expect(dest).toContain("v=transit");
    expect(dest).toContain("topics=1");

    fireEvent.click(screen.getByRole("button", { name: /police\s*\/\s*security/i }));
    expect(onPoliceSecurity).toHaveBeenCalledTimes(1);

    const emergency = screen.getByRole("link", { name: /emergency/i });
    expect(emergency.getAttribute("href")).toBe("tel:911");
  });

  it("hides Information when Guest Assist is disabled", () => {
    render(
      <ScanIntentChooser
        productLabel="Rapid Cortex"
        contextLabel="Venue Security"
        agencyName="Arena"
        zoneName="Gate A"
        vertical="venue"
        guestAssistEnabled={false}
        onPoliceSecurity={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: /information/i })).toBeNull();
    expect(screen.getByRole("button", { name: /police\s*\/\s*security/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /emergency/i }).getAttribute("href")).toBe("tel:911");
  });
});
