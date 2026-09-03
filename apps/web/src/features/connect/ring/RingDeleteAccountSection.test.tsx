/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserContext } from "rapid-cortex-shared/types";

const homeowner: UserContext = {
  userId: "u-home",
  agencyId: "test-agency",
  role: "homeowner",
  email: "owner@example.com",
};

vi.mock("@/components/auth/session-context", () => ({
  useSession: () => ({ user: homeowner, isLoading: false, refresh: async () => homeowner }),
}));

import { RingDeleteAccountSection } from "./RingDeleteAccountSection";

describe("RingDeleteAccountSection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("location", { href: "" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires a second confirmation click before calling DELETE", async () => {
    render(<RingDeleteAccountSection />);
    expect(screen.getByRole("button", { name: "Delete My Account" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Yes, delete my account" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));
    expect(screen.getByText(/permanently delete your account/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete my account" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/user/account",
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
  });
});
