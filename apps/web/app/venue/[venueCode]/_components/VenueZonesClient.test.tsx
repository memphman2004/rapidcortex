/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VenueZonesClient } from "./VenueZonesClient";

vi.mock("@/components/auth/session-context", () => ({
  useSession: () => ({
    user: { userId: "u1", role: "VENUE_ADMIN", agencyId: "agency-mbs" },
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/locations/qr-access", () => ({
  userCanManageQrLocations: () => true,
}));

vi.mock("@/lib/api", () => ({
  isApiConfigured: () => true,
}));

vi.mock("@/lib/locations-api", () => ({
  fetchLocations: vi.fn(async () => []),
  createLocation: vi.fn(),
}));

function wrap(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

describe("VenueZonesClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ locations: [] }), { status: 200 })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the add-zone dialog", async () => {
    render(wrap(<VenueZonesClient venueCode="MBS" />));
    fireEvent.click(screen.getByRole("button", { name: "Add Zone" }));
    expect(await screen.findByRole("dialog", { name: "Add zone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save zone" })).toBeTruthy();
  });
});
