import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDispatch } = vi.hoisted(() => ({ mockDispatch: vi.fn() }));

vi.mock("../../services/externalV1Dispatcher.js", () => ({
  dispatchExternalApiV1: mockDispatch,
}));

import { handler } from "./externalV1Http.js";

describe("externalV1 HTTP entry", () => {
  beforeEach(() => mockDispatch.mockReset());

  it("delegates to dispatcher", async () => {
    mockDispatch.mockResolvedValue({ statusCode: 200, body: "{}", headers: {} });
    const ev = {
      rawPath: "/api/v1/incidents/foo",
      requestContext: { http: { method: "GET" } },
    };
    await handler(ev as never, {} as never, () => {});
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
