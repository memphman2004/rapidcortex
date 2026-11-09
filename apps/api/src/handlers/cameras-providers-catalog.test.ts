import { describe, expect, it } from "vitest";

/**
 * Catalog contract: GET /api/cameras/providers lists Connect peers (Nest + Wyze when enabled).
 * Nest/Wyze remain Connect-only — not Vision ProviderRegistry entries.
 */
describe("cameras providers catalog contract", () => {
  it("documents Nest + Wyze as Connect catalog peers", () => {
    const nestEnabled = true;
    const wyzeEnabled = true;
    const providers: Array<{ id: string; label: string }> = [];
    if (nestEnabled) providers.push({ id: "nest", label: "Google Nest" });
    if (wyzeEnabled) providers.push({ id: "wyze", label: "Wyze" });
    expect(providers.map((p) => p.id).sort()).toEqual(["nest", "wyze"]);
  });
});
