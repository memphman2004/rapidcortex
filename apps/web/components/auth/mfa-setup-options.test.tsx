/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MfaSetupOptions } from "./mfa-setup-options";

const OTP_URL = "otpauth://totp/Rapid%20Cortex:user@agency.gov?secret=ABC";

vi.mock("qrcode", () => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,qr"),
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") },
}));

describe("MfaSetupOptions", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Google Authenticator QR and does not offer this-computer enrollment", async () => {
    render(
      <MfaSetupOptions
        accountLabel="user@agency.gov"
        totpSecret="ABC"
        otpauthUrl={OTP_URL}
        totpCode=""
        onTotpCodeChange={() => undefined}
      />,
    );

    expect(await screen.findByAltText("QR code for Google Authenticator")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "This computer" })).toBeNull();
    expect(screen.queryByRole("link", { name: /open in authenticator on this computer/i })).toBeNull();
    expect(screen.queryByText(/1Password/i)).toBeNull();
  });
});
