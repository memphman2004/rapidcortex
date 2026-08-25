/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EscalateTo911Modal } from "./escalate-to-911-modal";

describe("EscalateTo911Modal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("POSTs /api/escalations and closes on success", async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(
      <EscalateTo911Modal
        incidentId="inc-1"
        incidentType="Fight"
        locationDescription="Gate A"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Confirm escalation$/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/escalations",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      incidentId: string;
      incidentLocation: { description: string };
    };
    expect(body.incidentId).toBe("inc-1");
    expect(body.incidentLocation.description).toBe("Gate A");
  });

  it("surfaces a 403 from the API instead of closing", async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(
      <EscalateTo911Modal
        incidentId="inc-1"
        incidentType="Fight"
        locationDescription="Gate A"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Confirm escalation$/ }));
    expect(await screen.findByText(/Forbidden/i)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
