import { afterEach, describe, expect, it, vi } from "vitest";
import { connectPublicApiBase } from "./connect-public-api.js";

describe("connectPublicApiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_CONNECT_PUBLIC_BASE and strips a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_CONNECT_PUBLIC_BASE", "https://stack4.example.com/");
    expect(connectPublicApiBase()).toBe("https://stack4.example.com");
  });

  it("falls back to NEXT_PUBLIC_CAMERA_PUBLIC_API_BASE when the Connect base is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_CONNECT_PUBLIC_BASE", "");
    vi.stubEnv("NEXT_PUBLIC_CAMERA_PUBLIC_API_BASE", "https://camera.example.com/");
    expect(connectPublicApiBase()).toBe("https://camera.example.com");
  });
});
