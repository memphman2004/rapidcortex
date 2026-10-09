/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MfaMethodPicker } from "./mfa-method-picker";

describe("MfaMethodPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("offers email and authenticator choices", () => {
    const onChoose = vi.fn();
    render(
      <MfaMethodPicker accountLabel="user@agency.gov" onChoose={onChoose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /email me a 6-digit code/i }));
    expect(onChoose).toHaveBeenCalledWith("email");
    fireEvent.click(screen.getByRole("button", { name: /use an authenticator app/i }));
    expect(onChoose).toHaveBeenCalledWith("authenticator");
  });

  it("hides email when Cognito did not offer it", () => {
    render(
      <MfaMethodPicker
        accountLabel="user@agency.gov"
        allowed={["authenticator"]}
        onChoose={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: /email me a 6-digit code/i })).toBeNull();
    expect(screen.getByRole("button", { name: /use an authenticator app/i })).toBeTruthy();
  });
});
